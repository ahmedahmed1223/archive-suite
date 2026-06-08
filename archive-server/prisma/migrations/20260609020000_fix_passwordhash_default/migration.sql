-- Remove the empty-string DEFAULT from typed_users.passwordHash.
-- An empty default allows creating users with no password hash, which is a security flaw.
-- After this migration, INSERT statements must supply a non-empty hash explicitly.

ALTER TABLE "typed_users"
  ALTER COLUMN "passwordHash" DROP DEFAULT;

-- Prevent empty strings from being inserted.
ALTER TABLE "typed_users"
  ADD CONSTRAINT "typed_users_passwordhash_nonempty"
  CHECK ("passwordHash" <> '');
