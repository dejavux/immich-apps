import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  WebAuthnCredential,
} from "@simplewebauthn/server";

import { getSharedRedisClient } from "./redis-client";

export type StoredPasskeyCredential = WebAuthnCredential & {
  lineUserId: string;
};

export interface PasskeyCredentialStore {
  listByLineUser(lineUserId: string): Promise<StoredPasskeyCredential[]>;
  getByCredentialId(
    credentialId: Base64URLString,
  ): Promise<StoredPasskeyCredential | null>;
  save(params: {
    lineUserId: string;
    credentialId: Base64URLString;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  }): Promise<void>;
  updateCounter(credentialId: Base64URLString, counter: number): Promise<void>;
  revoke(lineUserId: string, credentialId: Base64URLString): Promise<boolean>;
}

const PASSKEY_USER_INDEX_PREFIX = "immich:passkey:user:";
const PASSKEY_CRED_PREFIX = "immich:passkey:cred:";

type SerializedCredential = {
  lineUserId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
};

function userIndexKey(lineUserId: string): string {
  return `${PASSKEY_USER_INDEX_PREFIX}${lineUserId}`;
}

function credKey(credentialId: string): string {
  return `${PASSKEY_CRED_PREFIX}${credentialId}`;
}

function serializeCredential(cred: StoredPasskeyCredential): SerializedCredential {
  return {
    lineUserId: cred.lineUserId,
    credentialId: cred.id,
    publicKey: Buffer.from(cred.publicKey).toString("base64"),
    counter: cred.counter,
    transports: cred.transports,
  };
}

function deserializeCredential(raw: SerializedCredential): StoredPasskeyCredential {
  return {
    id: raw.credentialId,
    lineUserId: raw.lineUserId,
    publicKey: new Uint8Array(Buffer.from(raw.publicKey, "base64")),
    counter: raw.counter,
    transports: raw.transports,
  };
}

export class RedisPasskeyCredentialStore implements PasskeyCredentialStore {
  constructor(
    private readonly client: NonNullable<
      Awaited<ReturnType<typeof getSharedRedisClient>>
    >,
  ) {}

  async listByLineUser(lineUserId: string): Promise<StoredPasskeyCredential[]> {
    const ids = await this.client.sMembers(userIndexKey(lineUserId));
    const creds: StoredPasskeyCredential[] = [];
    for (const id of ids) {
      const raw = await this.client.get(credKey(id));
      if (!raw) {
        continue;
      }
      creds.push(deserializeCredential(JSON.parse(raw) as SerializedCredential));
    }
    return creds;
  }

  async getByCredentialId(
    credentialId: Base64URLString,
  ): Promise<StoredPasskeyCredential | null> {
    const raw = await this.client.get(credKey(credentialId));
    if (!raw) {
      return null;
    }
    return deserializeCredential(JSON.parse(raw) as SerializedCredential);
  }

  async save(params: {
    lineUserId: string;
    credentialId: Base64URLString;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  }): Promise<void> {
    const stored: StoredPasskeyCredential = {
      id: params.credentialId,
      lineUserId: params.lineUserId,
      publicKey: new Uint8Array(params.publicKey),
      counter: params.counter,
      transports: params.transports,
    };
    await this.client.set(
      credKey(params.credentialId),
      JSON.stringify(serializeCredential(stored)),
    );
    await this.client.sAdd(userIndexKey(params.lineUserId), params.credentialId);
  }

  async updateCounter(credentialId: Base64URLString, counter: number): Promise<void> {
    const existing = await this.getByCredentialId(credentialId);
    if (!existing) {
      return;
    }
    existing.counter = counter;
    await this.client.set(
      credKey(credentialId),
      JSON.stringify(serializeCredential(existing)),
    );
  }

  async revoke(lineUserId: string, credentialId: Base64URLString): Promise<boolean> {
    const existing = await this.getByCredentialId(credentialId);
    if (!existing || existing.lineUserId !== lineUserId) {
      return false;
    }
    await this.client.del(credKey(credentialId));
    await this.client.sRem(userIndexKey(lineUserId), credentialId);
    return true;
  }
}

export class MemoryPasskeyCredentialStore implements PasskeyCredentialStore {
  private readonly byId = new Map<string, StoredPasskeyCredential>();
  private readonly byUser = new Map<string, Set<string>>();

  async listByLineUser(lineUserId: string): Promise<StoredPasskeyCredential[]> {
    const ids = this.byUser.get(lineUserId);
    if (!ids) {
      return [];
    }
    return [...ids]
      .map((id) => this.byId.get(id))
      .filter((cred): cred is StoredPasskeyCredential => cred !== undefined);
  }

  async getByCredentialId(
    credentialId: Base64URLString,
  ): Promise<StoredPasskeyCredential | null> {
    return this.byId.get(credentialId) ?? null;
  }

  async save(params: {
    lineUserId: string;
    credentialId: Base64URLString;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransportFuture[];
  }): Promise<void> {
    this.byId.set(params.credentialId, {
      id: params.credentialId,
      lineUserId: params.lineUserId,
      publicKey: new Uint8Array(params.publicKey),
      counter: params.counter,
      transports: params.transports,
    });
    const userSet = this.byUser.get(params.lineUserId) ?? new Set<string>();
    userSet.add(params.credentialId);
    this.byUser.set(params.lineUserId, userSet);
  }

  async updateCounter(credentialId: Base64URLString, counter: number): Promise<void> {
    const existing = this.byId.get(credentialId);
    if (existing) {
      existing.counter = counter;
    }
  }

  async revoke(lineUserId: string, credentialId: Base64URLString): Promise<boolean> {
    const existing = this.byId.get(credentialId);
    if (!existing || existing.lineUserId !== lineUserId) {
      return false;
    }
    this.byId.delete(credentialId);
    this.byUser.get(lineUserId)?.delete(credentialId);
    return true;
  }
}

let storePromise: Promise<PasskeyCredentialStore> | null = null;

export async function getPasskeyStore(): Promise<PasskeyCredentialStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const client = await getSharedRedisClient();
      if (client) {
        return new RedisPasskeyCredentialStore(client);
      }
      return new MemoryPasskeyCredentialStore();
    })();
  }
  return storePromise;
}
