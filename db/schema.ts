import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const plannerStates=sqliteTable('planner_states',{
 userId:text('user_id').primaryKey(),
 document:text('document').notNull(),
 revision:integer('revision').notNull().default(0),
 updatedAt:text('updated_at').notNull()
});
export const plannerWriteLimits=sqliteTable('planner_write_limits',{
 userId:text('user_id').primaryKey(),
 windowStart:integer('window_start').notNull(),
 attempts:integer('attempts').notNull()
});

// OAuth secrets are encrypted server-side and never included in plan exports.
export const outlookTokens=sqliteTable('outlook_tokens',{
 userId:text('user_id').primaryKey(), encrypted:text('encrypted').notNull()
});
export const outlookStates=sqliteTable('outlook_states',{
 state:text('state').primaryKey(), userId:text('user_id').notNull(),
 verifier:text('verifier').notNull(), expires:integer('expires').notNull()
});
