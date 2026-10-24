import * as carBay from './car_bay';
import * as classes from './class';
import * as inventory from './inventory';
import * as member from './member';
import * as organization from './organization';
import * as print from './print';

export { newId } from './id';

export const factory = {
  ...carBay,
  ...classes,
  ...inventory,
  ...member,
  ...organization,
  ...print,
};
