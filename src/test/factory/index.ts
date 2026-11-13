import * as carBay from './car-bay';
import * as classes from './class';
import * as inventory from './inventory';
import * as member from './member';
import * as memberAccess from './member-access';
import * as organization from './organization';
import * as pass from './pass';
import * as print from './print';
import * as printRequest from './print-request';
import * as service from './service';
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
  ...service,
  ...square,
};
