import { getDatabase } from "@netlify/database";
import { randomUUID, timingSafeEqual } from "node:crypto";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
  body: JSON.stringify(body),
});

const now = () => new Date().toISOString();
const safeString = (value, max = 120) => String(value ?? "").trim().slice(0, max);
const newId = () => randomUUID();
const initialState = () => ({
  version: 1,
  updatedAt: now(),
  config: { playerFee: null, teamFee: null, teamPurse: null, basePrice: null, minIncrement: null, maxSquad: null },
  players: [],
  teams: [],
  payments: [],
  auction: { status: "idle", playerId: null, basePrice: null, currentBid: 0, teamId: null, teamName: null, timerEndsAt: null, remainingSeconds: 20, history: [] },
});

function sameSecret(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function isAdmin(event) {
  const expected = process.env.RPL_ADMIN_TOKEN || "";
  const auth = event.headers?.authorization || event.headers?.Authorization || "";
  const supplied = auth.replace(/^Bearer\s+/i, "");
  return expected.length >= 32 && sameSecret(supplied, expected);
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (raw.length > 1_500_000) throw Object.assign(new Error("Request too large."), { statusCode: 413 });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Invalid JSON request body."), { statusCode: 400 }); }
}

function publicState(source) {
  const state = source || initialState();
  const players = (state.players || []).filter(p => p.status === "approved").map(p => ({
    id: p.id, regId: p.regId, name: p.name, age: p.age, village: p.village, role: p.role,
    batting: p.batting, bowling: p.bowling, jersey: p.jersey, photo: p.photo || "",
    status: p.status, auctionStatus: p.auctionStatus, basePrice: p.basePrice,
    soldTo: p.soldTo, soldPrice: p.soldPrice, soldTeam: p.soldTeam,
  }));
  const teams = (state.teams || []).filter(t => t.status === "approved").map(t => ({
    id: t.id, name: t.name, village: t.village, logo: t.logo || "", status: t.status,
    budget: t.budget, spent: t.spent || 0,
  }));
  return {
    version: state.version || 1,
    updatedAt: state.updatedAt,
    config: state.config || initialState().config,
    players,
    teams,
    payments: [],
    auction: state.auction || initialState().auction,
  };
}

function mergeById(current = [], incoming = []) {
  const map = new Map();
  for (const item of current) if (item?.id) map.set(item.id, item);
  for (const item of incoming) if (item?.id) map.set(item.id, item);
  const incomingIds = new Set(incoming.map(item => item?.id).filter(Boolean));
  return [
    ...incoming.filter(item => item?.id),
    ...current.filter(item => item?.id && !incomingIds.has(item.id)),
  ];
}

function mergeAdminState(current, incoming) {
  const safeIncoming = {
    ...incoming,
    config: { ...(current.config || {}), ...(incoming.config || {}) },
    players: mergeById(current.players || [], incoming.players || []),
    teams: mergeById(current.teams || [], incoming.teams || []),
    payments: mergeById(current.payments || [], incoming.payments || []),
  };
  safeIncoming.auction = {
    ...(current.auction || {}),
    ...(incoming.auction || {}),
    history: mergeById(current.auction?.history || [], incoming.auction?.history || []),
  };
  safeIncoming.version = 1;
  safeIncoming.updatedAt = now();
  return safeIncoming;
}

async function withLockedState(work) {
  const db = getDatabase();
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT data FROM rpl_state WHERE id = 1 FOR UPDATE");
    if (!result.rows.length) throw new Error("RPL database table is not initialized. Check the Netlify Database migration.");
    const state = result.rows[0].data || initialState();
    const outcome = await work(state);
    state.updatedAt = now();
    await client.query("UPDATE rpl_state SET data = $1::jsonb, updated_at = NOW() WHERE id = 1", [JSON.stringify(state)]);
    await client.query("COMMIT");
    return outcome;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* retain original error */ }
    throw error;
  } finally {
    client.release();
  }
}

async function readState() {
  const db = getDatabase();
  const result = await db.pool.query("SELECT data FROM rpl_state WHERE id = 1");
  if (!result.rows.length) throw new Error("RPL database is not initialized. Confirm Netlify Database is enabled and migration 0001 has run.");
  return result.rows[0].data || initialState();
}

function checkMediaUrl(value) {
  if (!value) return "";
  const s = safeString(value, 300);
  if (!/^\/.netlify\/functions\/media\?key=[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(s)) {
    throw Object.assign(new Error("Image upload is invalid. Please upload the image again."), { statusCode: 400 });
  }
  return s;
}

async function uploadImage(body) {
  const dataUrl = String(body.dataUrl || "");
  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error("Only JPG, PNG or WebP images are accepted."), { statusCode: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 350_000) throw Object.assign(new Error("Compressed image must be 350 KB or smaller."), { statusCode: 413 });
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const key = `${newId()}.${ext}`;
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("rpl-season5-media");
  const type = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  await store.set(key, new Blob([bytes], { type }), { metadata: { contentType: type, purpose: safeString(body.purpose, 24) } });
  return { url: `/.netlify/functions/media?key=${key}` };
}

export default async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Cache-Control": "no-store" }, body: "" };
  try {
    const query = event.queryStringParameters || {};

    if (event.httpMethod === "GET" && query.resource === "health") {
      await readState();
      return json(200, { ok: true, database: "connected", media: "Netlify Blobs", adminReady: (process.env.RPL_ADMIN_TOKEN || "").length >= 32 });
    }

    if (event.httpMethod === "GET" && query.resource === "public") {
      return json(200, { backend: true, state: publicState(await readState()) });
    }

    if (event.httpMethod === "GET" && query.resource === "admin") {
      if (!(process.env.RPL_ADMIN_TOKEN || "")) return json(503, { error: "Organizer login is not configured. Add RPL_ADMIN_TOKEN in Netlify environment variables." });
      if (!isAdmin(event)) return json(401, { error: "Invalid organizer access token." });
      return json(200, { backend: true, state: await readState() });
    }

    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
    const body = parseBody(event);

    if (query.action === "upload-image") {
      const result = await uploadImage(body);
      return json(201, { ok: true, ...result });
    }

    if (query.action === "register-player") {
      const required = ["name", "phone", "village", "role"];
      if (required.some(key => !safeString(body[key]))) return json(400, { error: "Please complete all required player fields." });
      const phone = safeString(body.phone, 10);
      if (!/^[0-9]{10}$/.test(phone)) return json(400, { error: "Enter a valid 10-digit mobile number." });
      const player = await withLockedState(state => {
        state.players ||= [];
        const id = newId();
        const used = new Set(state.players.map(p => p.regId));
        let n = state.players.length + 1;
        let regId = `RPL5-${String(n).padStart(4, "0")}`;
        while (used.has(regId)) { n += 1; regId = `RPL5-${String(n).padStart(4, "0")}`; }
        const item = {
          id, regId,
          name: safeString(body.name, 80), age: Number(body.age) || null, phone,
          village: safeString(body.village, 80), role: safeString(body.role, 30),
          batting: safeString(body.batting, 40), bowling: safeString(body.bowling, 40),
          jersey: safeString(body.jersey, 4), photo: checkMediaUrl(body.photo),
          status: "pending", auctionStatus: "awaiting", basePrice: null,
          soldTo: null, soldPrice: null, soldTeam: null, createdAt: now(),
        };
        state.players.push(item);
        return { regId: item.regId };
      });
      return json(201, { ok: true, ...player, status: "pending" });
    }

    if (query.action === "register-team") {
      const required = ["name", "owner", "phone", "village"];
      if (required.some(key => !safeString(body[key]))) return json(400, { error: "Please complete all required team fields." });
      const phone = safeString(body.phone, 10);
      if (!/^[0-9]{10}$/.test(phone)) return json(400, { error: "Enter a valid 10-digit mobile number." });
      const result = await withLockedState(state => {
        state.teams ||= [];
        const name = safeString(body.name, 70);
        if (state.teams.some(team => team.name?.toLowerCase() === name.toLowerCase())) {
          throw Object.assign(new Error("A team with this name is already registered."), { statusCode: 409 });
        }
        const item = {
          id: newId(), name, owner: safeString(body.owner, 80), phone,
          captain: safeString(body.captain, 80), village: safeString(body.village, 80),
          logo: checkMediaUrl(body.logo), status: "pending", budget: null, spent: 0, createdAt: now(),
        };
        state.teams.push(item);
        return { teamId: item.id };
      });
      return json(201, { ok: true, ...result, status: "pending" });
    }

    if (query.action === "submit-payment") {
      const payerName = safeString(body.payerName, 80);
      const payerPhone = safeString(body.payerPhone, 10);
      const utr = safeString(body.utr, 40);
      const amount = Number(body.amount);
      const purpose = safeString(body.purpose, 40);
      const paymentMethod = safeString(body.paymentMethod, 30);
      if (!payerName || !/^[0-9]{10}$/.test(payerPhone) || !utr || utr.length < 8 || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        return json(400, { error: "Enter a valid payer name, 10-digit mobile, amount and UTR." });
      }
      if (!["player_registration", "team_registration", "auction_other"].includes(purpose)) return json(400, { error: "Invalid payment purpose." });
      if (!["upi_qr", "upi_id", "google_pay", "phonepe", "paytm", "bhim", "backup_number", "other_upi"].includes(paymentMethod)) return json(400, { error: "Select a valid payment mode." });
      const result = await withLockedState(state => {
        state.payments ||= [];
        if (state.payments.some(p => String(p.utr || "").toLowerCase() === utr.toLowerCase())) {
          throw Object.assign(new Error("This UTR has already been submitted."), { statusCode: 409 });
        }
        const paymentId = `RPLPAY-${String(state.payments.length + 1).padStart(5, "0")}`;
        state.payments.unshift({
          id: newId(), paymentId, purpose, paymentMethod,
          reference: safeString(body.reference, 80), payerName, payerPhone, amount, utr,
          note: safeString(body.note, 250), status: "pending", submittedAt: now(),
        });
        return { paymentId, status: "pending" };
      });
      return json(201, { ok: true, ...result });
    }

    if (query.action === "admin-save") {
      if (!(process.env.RPL_ADMIN_TOKEN || "")) return json(503, { error: "Organizer login is not configured. Add RPL_ADMIN_TOKEN in Netlify environment variables." });
      if (!isAdmin(event)) return json(401, { error: "Invalid organizer access token." });
      const incoming = body;
      if (!incoming || !Array.isArray(incoming.players) || !Array.isArray(incoming.teams) || !Array.isArray(incoming.payments) || !incoming.auction || !incoming.config) {
        return json(400, { error: "Invalid RPL state payload." });
      }
      if (incoming.players.length > 5000 || incoming.teams.length > 500 || incoming.payments.length > 10000) return json(413, { error: "Record limit exceeded." });
      const saved = await withLockedState(current => {
        const merged = mergeAdminState(current, incoming);
        Object.assign(current, merged);
        return { updatedAt: current.updatedAt };
      });
      return json(200, { ok: true, ...saved });
    }

    return json(404, { error: "Unknown API action." });
  } catch (error) {
    const status = Number(error?.statusCode) || 503;
    const message = status === 503 && /database|relation|connect/i.test(error?.message || "")
      ? "Database is not ready. Check Netlify Database provisioning and the migration status, then redeploy."
      : (error?.message || "Unexpected server error.");
    return json(status, { error: message });
  }
};
