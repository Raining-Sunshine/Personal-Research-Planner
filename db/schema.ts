import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const plannerStates=sqliteTable('planner_states',{
 userId:text('user_id').primaryKey(),
 document:text('document').notNull(),
 revision:integer('revision').notNull().default(0),
 updatedAt:text('updated_at').notNull()
});
