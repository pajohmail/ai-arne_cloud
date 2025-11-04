import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let client: SecretManagerServiceClient | null = null;

function getClient() {
  if (!client) client = new SecretManagerServiceClient();
  return client;
}

export async function getSecret(secretId: string): Promise<string | undefined> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT!;
  const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;
  try {
    const [version] = await getClient().accessSecretVersion({ name });
    const payload = version?.payload?.data?.toString();
    return payload || undefined;
  } catch (err: any) {
    if (err?.code === 5) return undefined; // not found
    throw err;
  }
}

export async function setSecret(secretId: string, value: string): Promise<void> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT!;
  const parent = `projects/${projectId}`;
  const secretName = `projects/${projectId}/secrets/${secretId}`;

  // Ensure secret exists
  try {
    await getClient().getSecret({ name: secretName });
  } catch (err: any) {
    if (err?.code === 5) {
      await getClient().createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } }
      });
    } else {
      throw err;
    }
  }

  // Add new version
  await getClient().addSecretVersion({
    parent: secretName,
    payload: { data: Buffer.from(value, 'utf8') }
  });
}

export const SECRET_IDS = {
  linkedinAccessToken: 'LINKEDIN_ACCESS_TOKEN',
  linkedinRefreshToken: 'LINKEDIN_REFRESH_TOKEN',
  linkedinTokenMeta: 'LINKEDIN_TOKEN_META'
} as const;


