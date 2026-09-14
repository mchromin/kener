import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn("pages", "is_admin_only");
  if (!hasCol) {
    await knex.schema.alterTable("pages", (table) => {
      table.string("is_admin_only").defaultTo("NO").notNullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn("pages", "is_admin_only");
  if (hasCol) {
    await knex.schema.alterTable("pages", (table) => {
      table.dropColumn("is_admin_only");
    });
  }
}
