-- Prisma sent fileSize as float8 while this column was INTEGER, and Postgres rejected the bind (22P03).
ALTER TABLE "Project" ALTER COLUMN "fileSize" TYPE DOUBLE PRECISION;
