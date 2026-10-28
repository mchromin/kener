import type { Knex } from "knex";

/**
 * Add a timezone to incidents.
 *
 * Incident times were entered through timezone-naive `datetime-local` inputs and
 * interpreted against whatever timezone the editor's browser happened to be in, with
 * nothing recorded about which wall-clock the author actually meant. Two admins in
 * different regions editing the same incident saw different times in the form.
 *
 * Unlike `maintenances`, this column is NULLABLE rather than defaulting to "UTC".
 * Incidents have no recurrence rule, so the stored timestamp is already unambiguous and
 * the timezone is purely an authoring annotation. Backfilling existing rows with "UTC"
 * would make them suddenly render in UTC in the admin form instead of the viewer's
 * timezone — a visible shift, which is exactly the confusion this work is removing.
 *
 * NULL therefore means "not recorded, fall back to the viewer's selected timezone",
 * which reproduces the current behaviour exactly for existing incidents.
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("incidents", "timezone");
  if (!hasColumn) {
    await knex.schema.alterTable("incidents", (table) => {
      table.string("timezone", 64).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("incidents", "timezone");
  if (hasColumn) {
    await knex.schema.alterTable("incidents", (table) => {
      table.dropColumn("timezone");
    });
  }
}
