<script lang="ts">
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  // Within this many pixels of the bottom counts as fully read, so rounding never hides the cue.
  const SCROLL_END_TOLERANCE_PX = 8;
  const READ_MORE_STEP = 0.8;

  let agreementScroll = $state<HTMLDivElement>();
  let agreementEnd = $state(false);

  function updateAgreementEnd() {
    if (!agreementScroll) return;
    const { scrollTop, clientHeight, scrollHeight } = agreementScroll;
    agreementEnd = scrollTop + clientHeight >= scrollHeight - SCROLL_END_TOLERANCE_PX;
  }

  function readMore() {
    agreementScroll?.scrollBy({
      top: agreementScroll.clientHeight * READ_MORE_STEP,
      behavior: 'smooth',
    });
  }

  $effect(updateAgreementEnd);
</script>

<section class="relative rounded-xl border bg-card">
  <h2 class="border-b px-5 py-3 text-sm font-semibold tracking-wide uppercase sm:px-6">
    Waiver of Liability and Hold Harmless Agreement
  </h2>
  <div
    bind:this={agreementScroll}
    onscroll={updateAgreementEnd}
    class="flex max-h-[45dvh] flex-col gap-3 overflow-y-auto px-5 py-4 text-sm leading-relaxed sm:px-6"
  >
    <p>
      For and in consideration of receiving permission to use the Starforge Foundry Inc.
      ("Starforge") facilities, equipment and tools, I hereby COVENANT NOT TO SUE AND WAIVE ANY AND
      ALL CLAIMS AGAINST Starforge or its volunteers, officers, agents, directors or employees
      (collectively, the "RELEASEES"). I further agree to INDEMNIFY, DEFEND AND HOLD HARMLESS the
      RELEASESS from and against any and all liabilities, costs, claims, demands, and damages of any
      kind or character arising from or related to any loss, damage, or injury, including death,
      that may be sustained by me, or any of my personal property, while in, on or about the
      Starforge facility, using any equipment or tools located therein, or participating in any
      other activity at the Starforge facility WHETHER CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE
      OF THE RELEASEES OR OTHERWISE.
    </p>

    <p>
      I am fully aware of the unusual risks involved and hazards connected with any kind of use of
      the Starforge facility, equipment, and tools, especially the operation of saws, machines,
      tools and other metal and wood working equipment, and I hereby elect to voluntarily use the
      same with full knowledge that said activities may be hazardous to me and my property. I
      VOLUNTARILY ASSUME FULL RESPONSIBILITY FOR ANY RISKS OF LOSS, PROPERTY DAMAGE OR PERSONAL
      INJURY, INCLUDING DEATH, that may be sustained by me, or any loss or damage of property owned
      by me, as a result of being engaged in, or around others engaged in, such activities, WHETHER
      CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF RELEASEES OR OTHERWISE.
    </p>

    <p>
      I understand that Starforge may not maintain a current insurance policy covering any
      circumstance arising from my participation in the use of its facilities, equipment, and tools.
      As such, I am aware that I should review my personal insurance portfolio. It is my express
      intent that this Waiver of Liability and Hold Harmless Agreement shall bind the members of my
      family and spouse, if I am alive, and my heirs, assigns and personal representatives, if I am
      deceased, and shall be deemed as a FULL RELEASE, WAIVER, DISCHARGE AND COVENANT NOT TO SUE THE
      RELEASEES.
    </p>

    <p>
      No oral representations, statements, or inducements regarding my use of the Starforge
      facilities, equipment, and tools have been made. I am at least 18 years of age and fully
      competent and I execute this Release for full, adequate and complete consideration fully
      intending to be bound by hereby. IN SIGNING THIS RELEASE, I ACKNOWLEDGE AND REPRESENT THAT I
      HAVE READ THIS RELEASE IN ITS ENTIRETY AND HAVE SIGNED IT VOLUNTARILY.
    </p>
  </div>
  {#if !agreementEnd}
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 flex h-20 items-end justify-center rounded-b-xl bg-gradient-to-t from-card to-transparent pb-3"
    >
      <button
        type="button"
        class="pointer-events-auto flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
        onclick={readMore}
      >
        Read more
        <ChevronDownIcon class="size-4" />
      </button>
    </div>
  {/if}
</section>
