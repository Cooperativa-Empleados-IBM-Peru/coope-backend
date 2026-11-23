// Connection settings are read from environment variables so that no
// credentials are committed to the repository. In IBM Code Engine they are
// injected from the configmaps/secrets (see .github/workflows/deploy-code-engine.yml).
export const cloudantconfig = {
  name: process.env.CLOUDANT_NAME,
  connector: process.env.CLOUDANT_CONNECTOR,
  database: process.env.CLOUDANT_DATABASE,
  modelIndex: process.env.CLOUDANT_MODEL_INDEX,
  password: process.env.CLOUDANT_PASSWORD,
  url: process.env.CLOUDANT_URL,
  username: process.env.CLOUDANT_USERNAME,
};

export const db2config = {
  name: process.env.DB2_NAME,
  connector: process.env.DB2_CONNECTOR,
  database: process.env.DB2_DATABASE,
  host: process.env.DB2_HOSTNAME,
  password: process.env.DB2_PASSWORD,
  port: Number(process.env.DB2_PORT ?? 50000),
  dsn: process.env.DB2_DSN,
  user: process.env.DB2_USERNAME,
  schema: process.env.DB2_SCHEMA,
};
