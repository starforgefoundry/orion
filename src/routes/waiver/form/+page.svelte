<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import SignaturePad from '$lib/frontend/components/SignaturePad.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { submitWaiverForm } from '$lib/remotes/endpoints/waiver.remote';
  import { Button, Card, CardBody, Field, Heading, Stack, Text } from '@immich/ui';

  let signature = $state('');
  $effect(() => {
    submitWaiverForm.fields.signature.set(signature);
  });

  let submitEnabled = $derived(signature !== '');
</script>

<svelte:head>
  <title>Starforge Waiver</title>
</svelte:head>

<div class="flex items-center justify-center p-4">
  <form
    {...submitWaiverForm.enhance(() => {})}
    class="flex w-full max-w-3xl flex-col items-center justify-center gap-4"
  >
    <img src={logo} alt="Orion Logo" class="mt-6 h-16 w-16 self-start" />

    <Heading class="self-start" size="giant">Starforge Waiver</Heading>
    <Text>
      Please read the waiver below carefully, then sign and submit the form.
    </Text>

    <Card class="w-full">
      <CardBody>
        <Stack gap={4}>
          <Text fontWeight="bold" class="text-center uppercase">
            Waiver of Liability and Hold Harmless Agreement — Starforge Foundry Inc.
          </Text>

          <Text>
            For and in consideration of receiving permission to use the Starforge Foundry Inc.
            ("Starforge") facilities, equipment and tools, I hereby COVENANT NOT TO SUE AND WAIVE ANY
            AND ALL CLAIMS AGAINST Starforge or its volunteers, officers, agents, directors or
            employees (collectively, the "RELEASEES"). I further agree to INDEMNIFY, DEFEND AND HOLD
            HARMLESS the RELEASESS from and against any and all liabilities, costs, claims, demands,
            and damages of any kind or character arising from or related to any loss, damage, or
            injury, including death, that may be sustained by me, or any of my personal property,
            while in, on or about the Starforge facility, using any equipment or tools located
            therein, or participating in any other activity at the Starforge facility WHETHER CAUSED
            IN WHOLE OR IN PART BY THE NEGLIGENCE OF THE RELEASEES OR OTHERWISE.
          </Text>

          <Text>
            I am fully aware of the unusual risks involved and hazards connected with any kind of use
            of the Starforge facility, equipment, and tools, especially the operation of saws,
            machines, tools and other metal and wood working equipment, and I hereby elect to
            voluntarily use the same with full knowledge that said activities may be hazardous to me
            and my property. I VOLUNTARILY ASSUME FULL RESPONSIBILITY FOR ANY RISKS OF LOSS, PROPERTY
            DAMAGE OR PERSONAL INJURY, INCLUDING DEATH, that may be sustained by me, or any loss or
            damage of property owned by me, as a result of being engaged in, or around others engaged
            in, such activities, WHETHER CAUSED IN WHOLE OR IN PART BY THE NEGLIGENCE OF RELEASEES OR
            OTHERWISE.
          </Text>

          <Text>
            I understand that Starforge may not maintain a current insurance policy covering any
            circumstance arising from my participation in the use of its facilities, equipment, and
            tools. As such, I am aware that I should review my personal insurance portfolio. It is my
            express intent that this Waiver of Liability and Hold Harmless Agreement shall bind the
            members of my family and spouse, if I am alive, and my heirs, assigns and personal
            representatives, if I am deceased, and shall be deemed as a FULL RELEASE, WAIVER,
            DISCHARGE AND COVENANT NOT TO SUE THE RELEASEES.
          </Text>

          <Text>
            No oral representations, statements, or inducements regarding my use of the Starforge
            facilities, equipment, and tools have been made. I am at least 18 years of age and fully
            competent and I execute this Release for full, adequate and complete consideration fully
            intending to be bound by hereby. IN SIGNING THIS RELEASE, I ACKNOWLEDGE AND REPRESENT
            THAT I HAVE READ THIS RELEASE IN ITS ENTIRETY AND HAVE SIGNED IT VOLUNTARILY.
          </Text>
        </Stack>
      </CardBody>
    </Card>

    <hr class="my-4 w-full border-gray-300" />

    <Field label="First Name" required="indicator">
      <TextInput
        {...submitWaiverForm.fields.firstName.as('text')}
        placeholder="John"
        class="max-w-xs"
      />
    </Field>

    <Field label="Last Name" required="indicator">
      <TextInput
        {...submitWaiverForm.fields.lastName.as('text')}
        placeholder="Doe"
        class="max-w-xs"
      />
    </Field>

    <Field label="Email" required="indicator">
      <TextInput
        {...submitWaiverForm.fields.email.as('text')}
        type="email"
        placeholder="john@example.com"
        class="max-w-xs"
      />
    </Field>

    <Field label="Signature" required="indicator">
      <SignaturePad bind:signature />
    </Field>
    <input {...submitWaiverForm.fields.signature.as('text')} hidden />

    <Button type="submit" class="mt-2 self-start" disabled={!submitEnabled}>
      Sign Waiver
    </Button>

    <Text size="small" color="muted" class="mt-4 mb-8 self-start italic">
      If you have any issues or questions, please contact us at
      <a href="mailto:info@starforgefoundry.com" class="underline">info@starforgefoundry.com</a>
    </Text>
  </form>
</div>
