-- RPL Season 5 state store. All writes are performed inside PostgreSQL transactions
-- with SELECT ... FOR UPDATE in the Netlify Function.
CREATE TABLE IF NOT EXISTS rpl_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO rpl_state (id, data)
VALUES (
  1,
  jsonb_build_object(
    'version', 1,
    'updatedAt', NOW(),
    'config', jsonb_build_object(
      'playerFee', NULL,
      'teamFee', NULL,
      'teamPurse', NULL,
      'basePrice', NULL,
      'minIncrement', NULL,
      'maxSquad', NULL
    ),
    'players', '[]'::jsonb,
    'teams', '[]'::jsonb,
    'payments', '[]'::jsonb,
    'auction', jsonb_build_object(
      'status', 'idle',
      'playerId', NULL,
      'basePrice', NULL,
      'currentBid', 0,
      'teamId', NULL,
      'teamName', NULL,
      'timerEndsAt', NULL,
      'remainingSeconds', 20,
      'history', '[]'::jsonb
    )
  )
)
ON CONFLICT (id) DO NOTHING;
