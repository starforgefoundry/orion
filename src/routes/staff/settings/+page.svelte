<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { cn } from '$lib/frontend/cn';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    getBambuddySettings,
    getCarBayPolicy,
    getCarBayRates,
    getClassSettings,
    getPrintRequestSettings,
    getPrintPricing,
    getPrintRequestSquareSettings,
  } from '$lib/remotes/endpoints/settings.remote';
  import { EMAIL_TEMPLATE_GROUP, type EmailTemplateGroup } from '$lib/utils/email_templates';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CarIcon from '@lucide/svelte/icons/car';
  import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
  import CreditCardIcon from '@lucide/svelte/icons/credit-card';
  import Printer3dIcon from '@lucide/svelte/icons/printer-3d';
  import TabletIcon from '@lucide/svelte/icons/tablet';
  import UsersIcon from '@lucide/svelte/icons/users';
  import type { Component } from 'svelte';
  import BambuddySettings from './BambuddySettings.svelte';
  import BambuddyStatus from './BambuddyStatus.svelte';
  import CarBaySettings from './CarBaySettings.svelte';
  import ClassSettings from './ClassSettings.svelte';
  import EmailTemplateSettings from './EmailTemplateSettings.svelte';
  import KioskSettings from './KioskSettings.svelte';
  import MemberSquareSettings from './MemberSquareSettings.svelte';
  import SettingsSection from './SettingsSection.svelte';
  import SquareInfoModal from './SquareInfoModal.svelte';
  import PrintPricingSettings from './PrintPricingSettings.svelte';
  import SquareSettings from './SquareSettings.svelte';
  import SystemSettings from './SystemSettings.svelte';

  const SECTION_PARAM = 'section';

  const SECTIONS = {
    PRINTING: '3d-printing',
    SQUARE: 'square',
    CLASSES: 'classes',
    CAR_BAY: 'car-bay',
    MEMBERS: 'members',
    KIOSK: 'kiosk',
  } as const;
  type SectionId = (typeof SECTIONS)[keyof typeof SECTIONS];

  type SectionInfo = {
    id: SectionId;
    title: string;
    description: string;
    icon: Component;
    emailTemplates?: { group: EmailTemplateGroup; description: string };
  };

  const SECTION_LIST: SectionInfo[] = [
    {
      id: SECTIONS.PRINTING,
      title: '3D Printing',
      description: 'Print request intake and the connection to the printers.',
      icon: Printer3dIcon,
      emailTemplates: {
        group: EMAIL_TEMPLATE_GROUP.PRINTING,
        description: 'Emails sent to customers as their print request moves along.',
      },
    },
    {
      id: SECTIONS.SQUARE,
      title: 'Square',
      description: 'Location and catalog items used when billing print requests.',
      icon: CreditCardIcon,
      emailTemplates: {
        group: EMAIL_TEMPLATE_GROUP.PAYMENTS,
        description: 'Payment requests for organization balances and car bay overruns.',
      },
    },
    {
      id: SECTIONS.CLASSES,
      title: 'Classes',
      description: 'Notifications for class bookings.',
      icon: CalendarIcon,
      emailTemplates: {
        group: EMAIL_TEMPLATE_GROUP.CLASSES,
        description: 'Emails sent to people who book a class.',
      },
    },
    {
      id: SECTIONS.CAR_BAY,
      title: 'Car Bay',
      description: 'Open hours, booking lengths, booking window and rates.',
      icon: CarIcon,
      emailTemplates: {
        group: EMAIL_TEMPLATE_GROUP.CAR_BAY,
        description: 'Emails sent to people who book the car bay.',
      },
    },
    {
      id: SECTIONS.MEMBERS,
      title: 'Members',
      description: 'Square day pass items and syncing memberships from Square.',
      icon: UsersIcon,
      emailTemplates: {
        group: EMAIL_TEMPLATE_GROUP.MEMBERS,
        description: 'Emails sent to members to set up their pass.',
      },
    },
    {
      id: SECTIONS.KIOSK,
      title: 'Check-in Kiosk',
      description: 'Pairing the iPad that scans member passes.',
      icon: TabletIcon,
    },
  ];

  const active = $derived(
    SECTION_LIST.find((section) => section.id === page.url.searchParams.get(SECTION_PARAM)) ??
      SECTION_LIST[0],
  );

  const printRequestSettings = getPrintRequestSettings();
  const squareSettings = getPrintRequestSquareSettings();
  const printPricing = getPrintPricing();
  const classSettings = getClassSettings();
  const carBayRates = getCarBayRates();
  const carBayPolicy = getCarBayPolicy();
  const bambuddySettings = getBambuddySettings();
</script>

{#snippet loadState(query: { loading: boolean; error?: unknown }, name: string)}
  {#if query.loading}
    <Spinner />
  {:else if query.error}
    <p class="text-sm text-destructive">Error loading {name} settings.</p>
  {/if}
{/snippet}

<PageHeader title="Settings" />

<div class="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
  <nav
    aria-label="Settings sections"
    class="-mx-3 flex shrink-0 gap-1 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 md:sticky md:top-4 md:mx-0 md:w-52 md:flex-col md:overflow-visible md:px-0 md:pb-0"
  >
    {#each SECTION_LIST as section (section.id)}
      <a
        href={`?${SECTION_PARAM}=${section.id}`}
        data-sveltekit-replacestate
        data-sveltekit-noscroll
        aria-current={active.id === section.id ? 'page' : undefined}
        class={cn(
          'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
          active.id === section.id
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
      >
        <section.icon class="size-4 shrink-0" />
        {section.title}
      </a>
    {/each}
  </nav>

  <div class="flex min-w-0 flex-1 flex-col gap-6 md:max-w-3xl">
    {#if active.id === SECTIONS.PRINTING}
      <div class="flex flex-col gap-6">
        <SettingsSection
          title="Print Requests"
          description="Intake form, announcements, upload limits and notifications."
          formId="print-request-settings"
        >
          {@render loadState(printRequestSettings, 'print request')}
          {#if printRequestSettings.current}
            <SystemSettings printRequestSettings={printRequestSettings.current} />
          {/if}
        </SettingsSection>
        <SettingsSection
          title="Print Pricing"
          description="Build plate price and member discount used when billing print requests."
          formId="print-pricing-settings"
        >
          {@render loadState(printPricing, 'print pricing')}
          {#if printPricing.current}
            <PrintPricingSettings pricing={printPricing.current} />
          {/if}
        </SettingsSection>
        <SettingsSection
          title="Bambuddy"
          description="Connection to the server that talks to the printers."
          formId="bambuddy-settings"
        >
          <div class="flex flex-col gap-4">
            <BambuddyStatus />
            {@render loadState(bambuddySettings, 'Bambuddy')}
            {#if bambuddySettings.current}
              <BambuddySettings bambuddySettings={bambuddySettings.current} />
            {/if}
          </div>
        </SettingsSection>
      </div>
    {:else if active.id === SECTIONS.SQUARE}
      <SettingsSection
        title={active.title}
        description={active.description}
        formId="square-settings"
      >
        {#snippet actions()}
          <Button variant="ghost" size="sm" onclick={() => modalManager.show(SquareInfoModal)}>
            <CircleHelpIcon />
            Setup help
          </Button>
        {/snippet}
        {@render loadState(squareSettings, 'Square')}
        {#if squareSettings.current}
          <SquareSettings squareSettings={squareSettings.current} />
        {/if}
      </SettingsSection>
    {:else if active.id === SECTIONS.CLASSES}
      <SettingsSection
        title={active.title}
        description={active.description}
        formId="class-settings"
      >
        {@render loadState(classSettings, 'class')}
        {#if classSettings.current}
          <ClassSettings classSettings={classSettings.current} />
        {/if}
      </SettingsSection>
    {:else if active.id === SECTIONS.CAR_BAY}
      <SettingsSection
        title={active.title}
        description={active.description}
        formId="car-bay-settings"
      >
        {@render loadState(carBayRates, 'car bay rates')}
        {@render loadState(carBayPolicy, 'car bay rules')}
        {#if carBayRates.current && carBayPolicy.current}
          <CarBaySettings rates={carBayRates.current} policy={carBayPolicy.current} />
        {/if}
      </SettingsSection>
    {:else if active.id === SECTIONS.MEMBERS}
      <SettingsSection
        title={active.title}
        description={active.description}
        formId="member-square-settings"
      >
        <MemberSquareSettings />
      </SettingsSection>
    {:else if active.id === SECTIONS.KIOSK}
      <SettingsSection title={active.title} description={active.description}>
        <KioskSettings />
      </SettingsSection>
    {/if}
    {#if active.emailTemplates}
      <EmailTemplateSettings {...active.emailTemplates} />
    {/if}
  </div>
</div>
