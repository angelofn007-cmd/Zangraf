BEGIN;
-- Links de aprovação: o fotógrafo envia prévias das lâminas e o cliente final comenta e aprova, sem conta.
CREATE TABLE IF NOT EXISTS zangraf_album_shares (
 id uuid PRIMARY KEY,
 token text NOT NULL UNIQUE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 project_id text NOT NULL,
 album_name text NOT NULL,
 version integer NOT NULL DEFAULT 1,
 -- [{index, label, pathname, width, height, size}] — index é a página no projeto (-1 capa, -2 verso, 0.. lâminas)
 pages jsonb NOT NULL DEFAULT '[]',
 bytes bigint NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','waiting','changes','approved')),
 approved_by text, approved_at timestamptz,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,project_id)
);
CREATE INDEX IF NOT EXISTS zangraf_album_shares_expires ON zangraf_album_shares(expires_at);
CREATE TABLE IF NOT EXISTS zangraf_album_comments (
 id uuid PRIMARY KEY,
 share_id uuid NOT NULL REFERENCES zangraf_album_shares(id) ON DELETE CASCADE,
 version integer NOT NULL,
 page integer NOT NULL,
 author text NOT NULL,
 body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zangraf_album_comments_share ON zangraf_album_comments(share_id,created_at);
COMMIT;
