import { submitWithToast } from '$lib/frontend/form-submit';
import { DAYS_IN_WEEK } from '$lib/frontend/month-grid';
import {
  createInstance,
  generateInstances,
  getAllInstances,
  getCatalogs,
  getStaffUsers,
} from '$lib/remotes/endpoints/class.remote';
import { weeklyDates } from '$lib/utils/classes';
import { DateTime } from 'luxon';
import { toast } from 'svelte-sonner';

export const DEFAULT_DURATION_MINUTES = 60;
export const DEFAULT_SEATS = 3;

export class ScheduleClassForm {
  classId = $state('');
  teacherEmail = $state('');
  date = $state(DateTime.now().toISODate());
  startTime = $state('');
  durationMinutes = $state(DEFAULT_DURATION_MINUTES);
  seats = $state(DEFAULT_SEATS);
  recurring = $state(false);
  endDate = $state('');
  submitting = $state(false);

  readonly catalogs = getCatalogs();
  readonly staff = getStaffUsers();

  get catalogOptions() {
    return (this.catalogs.current ?? []).map((c) => ({ label: c.name, value: c.id }));
  }

  get staffOptions() {
    return (this.staff.current ?? []).map((u) => ({ label: u.name, value: u.email }));
  }

  private get start() {
    return this.date ? DateTime.fromISO(this.date) : undefined;
  }

  private get end() {
    return this.endDate ? DateTime.fromISO(this.endDate) : undefined;
  }

  get dayOfWeek() {
    return this.start ? this.start.weekday % DAYS_IN_WEEK : 0;
  }

  /** How many weekly classes a recurring schedule creates. */
  get classCount() {
    const start = this.start;
    const end = this.end;
    if (!this.recurring || !start?.isValid || !end?.isValid) return 0;
    return weeklyDates(start.toISODate()!, end.toISODate()!, this.dayOfWeek).length;
  }

  get submitLabel() {
    return this.recurring ? `Create ${this.classCount} Classes` : 'Create Class';
  }

  get canSubmit() {
    return !(this.recurring && this.classCount === 0);
  }

  /** Resolves true once the classes are created. */
  async submit() {
    const start = this.start;
    if (!this.classId || !this.teacherEmail || !start || !this.startTime) {
      toast.error('Please fill in all fields');
      return false;
    }

    const end = this.end;
    if (this.recurring && !end) {
      toast.error('Please fill in the end date');
      return false;
    }

    const details = {
      classId: this.classId,
      teacherEmail: this.teacherEmail,
      startTime: this.startTime,
      durationMinutes: this.durationMinutes,
      seats: this.seats,
    };
    const count = this.classCount;

    this.submitting = true;
    const created =
      this.recurring && end
        ? await submitWithToast(
            () =>
              generateInstances({
                ...details,
                dayOfWeek: this.dayOfWeek,
                startDate: start.toISODate()!,
                endDate: end.toISODate()!,
              }),
            {
              success: `Created ${count} class${count !== 1 ? 'es' : ''}`,
              error: 'Failed to generate classes',
            },
          )
        : await submitWithToast(() => createInstance({ ...details, date: start.toISODate()! }), {
            success: 'Class created',
            error: 'Failed to create class',
          });

    if (created) await getAllInstances().refresh();
    this.submitting = false;
    return created;
  }
}
