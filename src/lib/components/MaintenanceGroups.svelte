<script lang="ts">
  import * as Accordion from "$lib/components/ui/accordion/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import MaintenanceItem from "$lib/components/MaintenanceItem.svelte";
  import { t } from "$lib/stores/i18n";
  import type { MaintenanceEventsMonitorList } from "$lib/server/types/db";

  interface Props {
    ongoing?: MaintenanceEventsMonitorList[];
    upcoming?: MaintenanceEventsMonitorList[];
    past?: MaintenanceEventsMonitorList[];
  }

  let { ongoing = [], upcoming = [], past = [] }: Props = $props();

  // Open ongoing by default if there are any items; keep upcoming/past collapsed.
  const defaultOpen = $derived(ongoing.length > 0 ? ["ongoing"] : []);

  const hasAny = $derived(ongoing.length + upcoming.length + past.length > 0);
</script>

{#if hasAny}
  <div class="rounded-3xl border">
    <Accordion.Root type="multiple" value={defaultOpen} class="w-full">
      {#if ongoing.length > 0}
        <Accordion.Item value="ongoing" class="border-b last:border-b-0">
          <Accordion.Trigger class="px-3 sm:px-4">
            <div class="flex items-center gap-2">
              <span class="text-base font-medium">{$t("Ongoing")} {$t("Maintenances")}</span>
              <Badge variant="secondary">{ongoing.length}</Badge>
            </div>
          </Accordion.Trigger>
          <Accordion.Content class="px-3 sm:px-4">
            <div class="flex flex-col gap-3 pb-2">
              {#each ongoing as maintenance, i (maintenance.id ?? i)}
                <div class="rounded-2xl border p-3 sm:p-4">
                  <MaintenanceItem {maintenance} />
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if upcoming.length > 0}
        <Accordion.Item value="upcoming" class="border-b last:border-b-0">
          <Accordion.Trigger class="px-3 sm:px-4">
            <div class="flex items-center gap-2">
              <span class="text-base font-medium">{$t("Upcoming")} {$t("Maintenances")}</span>
              <Badge variant="secondary">{upcoming.length}</Badge>
            </div>
          </Accordion.Trigger>
          <Accordion.Content class="px-3 sm:px-4">
            <div class="flex flex-col gap-3 pb-2">
              {#each upcoming as maintenance, i (maintenance.id ?? i)}
                <div class="rounded-2xl border p-3 sm:p-4">
                  <MaintenanceItem {maintenance} />
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/if}

      {#if past.length > 0}
        <Accordion.Item value="past" class="border-b last:border-b-0">
          <Accordion.Trigger class="px-3 sm:px-4">
            <div class="flex items-center gap-2">
              <span class="text-base font-medium">{$t("Past")} {$t("Maintenances")}</span>
              <Badge variant="secondary">{past.length}</Badge>
            </div>
          </Accordion.Trigger>
          <Accordion.Content class="px-3 sm:px-4">
            <div class="flex flex-col gap-3 pb-2">
              {#each past as maintenance, i (maintenance.id ?? i)}
                <div class="rounded-2xl border p-3 sm:p-4">
                  <MaintenanceItem {maintenance} />
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/if}
    </Accordion.Root>
  </div>
{/if}
