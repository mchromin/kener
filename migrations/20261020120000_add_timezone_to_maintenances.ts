import type { Knex } from "knex";

/**
 * Add a timezone to maintenances.
 *
 * Recurrence rules are only meaningful relative to a timezone: occurrences were
 * previously expanded against a UTC-anchored DTSTART, so the local wall-clock time of a
 * recurring maintenance drifted by an hour across daylight saving transitions.
 *
 * Existing rows default to "UTC", which reproduces the previous behaviour exactly, so
 * the migration is non-breaking for already scheduled maintenances.
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("maintenances", "timezone");
  if (!hasColumn) {
    await knex.schema.alterTable("maintenances", (table) => {
      table.string("timezone", 64).notNullable().defaultTo("UTC");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("maintenances", "timezone");
  if (hasColumn) {
    await knex.schema.alterTable("maintenances", (table) => {
      table.dropColumn("timezone");
    });
  }
}
