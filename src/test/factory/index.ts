import * as carBay from './car_bay';
import * as classes from './class';
import * as inventory from './inventory';
import * as member from './member';
import * as memberAccess from './member_access';
import * as organization from './organization';
import * as pass from './pass';
import * as print from './print';
import * as printRequest from './print_request';
import * as square from './square';

export { newId } from './id';

export const factory = {
  ...carBay,
  ...classes,
  ...inventory,
  ...member,
  ...memberAccess,
  ...organization,
  ...pass,
  ...print,
  ...printRequest,
  ...square,
};
