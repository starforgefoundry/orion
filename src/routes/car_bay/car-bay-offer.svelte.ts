import {
  getCarBayAvailability,
  getCarBayPolicy,
  getCarBayRates,
} from '$lib/remotes/endpoints/settings.remote';

/** The bay's prices, rules and whether it takes bookings at all. */
export class CarBayOffer {
  #rates = getCarBayRates();
  #policy = getCarBayPolicy();
  #availability = getCarBayAvailability();

  get rates() {
    return this.#rates.current;
  }

  get policy() {
    return this.#policy.current;
  }

  get loading() {
    return this.#rates.loading || this.#policy.loading || this.#availability.loading;
  }

  get closed() {
    const availability = this.#availability.current;
    return !!availability && !availability.isOpen;
  }
}
