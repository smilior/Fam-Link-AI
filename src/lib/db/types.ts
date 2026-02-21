import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { user, session } from "./schema";

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
