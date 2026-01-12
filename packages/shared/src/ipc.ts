export type AccountId = string;

export interface AccountSummary {
  id: AccountId;
  label: string;
  dataDir: string;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface CreateAccountInput {
  label: string;
  password: string;
  dataRootDir?: string | null;
}

export interface UnlockAccountInput {
  accountId: AccountId;
  password: string;
}

export interface MyTraderApi {
  account: {
    getActive(): Promise<AccountSummary | null>;
    list(): Promise<AccountSummary[]>;
    create(input: CreateAccountInput): Promise<AccountSummary>;
    unlock(input: UnlockAccountInput): Promise<AccountSummary>;
    lock(): Promise<void>;
    chooseDataRootDir(): Promise<string | null>;
  };
}

export const IPC_CHANNELS = {
  ACCOUNT_GET_ACTIVE: "account:getActive",
  ACCOUNT_LIST: "account:list",
  ACCOUNT_CREATE: "account:create",
  ACCOUNT_UNLOCK: "account:unlock",
  ACCOUNT_LOCK: "account:lock",
  ACCOUNT_CHOOSE_DATA_ROOT_DIR: "account:chooseDataRootDir"
} as const;

