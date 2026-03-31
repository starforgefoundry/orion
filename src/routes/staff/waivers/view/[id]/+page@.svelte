<script lang="ts">
  import { page } from '$app/state';
  import { getWaiverById } from '$lib/remotes/endpoints/waiver.remote';
  import { LoadingSpinner, Text } from '@immich/ui';

  let waiver = $derived(getWaiverById(page.params.id));

  let signedDate = $derived(() => {
    if (!waiver.current) return '';
    const d = waiver.current.signedDate;
    if (typeof d === 'object' && 'toLocaleString' in d) {
      return (d as { toLocaleString: (opts: object) => string }).toLocaleString({
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return new Date(String(d)).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });
</script>

<svelte:head>
  <title>Signed Waiver</title>
</svelte:head>

{#if waiver.loading}
  <div class="flex min-h-screen items-center justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if waiver.error}
  <div class="flex min-h-screen items-center justify-center">
    <Text color="danger">Error loading waiver: {waiver.error.message}</Text>
  </div>
{:else if waiver.current}
  <div class="mx-auto max-w-3xl bg-white p-12 pt-4 text-black">
    <h1 class="text-center text-xl font-bold">WAIVER OF LIABILITY AND HOLD HARMLESS AGREEMENT</h1>
    <h2 class="mb-6 text-center text-lg font-bold">STARFORGE FOUNDRY INC.</h2>

    <div class="flex flex-col gap-2 text-sm leading-snug">
      <p class="text-justify">
        For and in consideration of receiving permission to use the Starforge Foundry Inc.
        ("Starforge") facilities, equipment and tools, I hereby COVENANT NOT TO SUE AND WAIVE ANY
        AND ALL CLAIMS AGAINST Starforge or its volunteers, officers, agents, directors or employees
        (collectively, the "RELEASEES"). I further agree to INDEMNIFY, DEFEND AND HOLD HARMLESS the
        RELEASESS from and against any and all liabilities, costs, claims, demands, and damages of
        any kind or character arising from or related to any loss, damage, or injury, including
        death, that may be sustained by me, or any of my personal property, while in, on or about
        the Starforge facility, using any equipment or tools located therein, or participating in
        any other activity at the Starforge facility WHETHER CAUSED IN WHOLE OR IN PART BY THE
        NEGLIGENCE OF THE RELEASEES OR OTHERWISE.
      </p>

      <p class="text-justify">
        I am fully aware of the unusual risks involved and hazards connected with any kind of use of
        the Starforge facility, equipment, and tools, especially the operation of saws, machines,
        tools and other metal and wood working equipment, and I hereby elect to voluntarily use the
        same with full knowledge that said activities may be hazardous to me and my property. I
        VOLUNTARILY ASSUME FULL RESPONSIBILITY FOR ANY RISKS OF LOSS, PROPERTY DAMAGE OR PERSONAL
        INJURY, INCLUDING DEATH, that may be sustained by me, or any loss or damage of property
        owned by me, as a result of being engaged in, or around others engaged in, such activities,
        WHETHER CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF RELEASEES OR OTHERWISE.
      </p>

      <p class="text-justify">
        I understand that Starforge may not maintain a current insurance policy covering any
        circumstance arising from my participation in the use of its facilities, equipment, and
        tools. As such, I am aware that I should review my personal insurance portfolio. It is my
        express intent that this Waiver of Liability and Hold Harmless Agreement shall bind the
        members of my family and spouse, if I am alive, and my heirs, assigns and personal
        representatives, if I am deceased, and shall be deemed as a FULL RELEASE, WAIVER, DISCHARGE
        AND COVENANT NOT TO SUE THE RELEASEES.
      </p>

      <p class="text-justify">
        No oral representations, statements, or inducements regarding my use of the Starforge
        facilities, equipment, and tools have been made. I am at least 18 years of age and fully
        competent and I execute this Release for full, adequate and complete consideration fully
        intending to be bound by hereby. IN SIGNING THIS RELEASE, I ACKNOWLEDGE AND REPRESENT THAT I
        HAVE READ THIS RELEASE IN ITS ENTIRETY AND HAVE SIGNED IT VOLUNTARILY.
      </p>
    </div>

    <div class="mt-8 flex items-start justify-between">
      <div>
        <p class="text-base font-bold">
          Name: {waiver.current.firstName}
          {waiver.current.lastName}
        </p>
        <p class="text-base">Email: {waiver.current.email}</p>
        <p class="text-base">Date Signed: {signedDate()}</p>
      </div>

      <img src={waiver.current.signatureUrl} alt="Signature" class="mt-2 max-w-[200px]" />
    </div>
  </div>
{/if}

<style>
  @media print {
    :global(body) {
      background: white !important;
    }
  }
</style>
