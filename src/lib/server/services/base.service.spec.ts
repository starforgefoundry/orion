import { EmailTemplateRepository } from '$lib/server/repositories/email_template.repository';
import { BaseService, REPOSITORIES } from '$lib/server/services/base.service';
import { describe, expect, it } from 'vitest';

class TestService extends BaseService {
  dependencyOf(key: 'mailgunGateway') {
    return (this[key] as unknown as { emailTemplateRepository: unknown }).emailTemplateRepository;
  }
}

describe(BaseService.name, () => {
  it('gives the service one instance of every registered repository', () => {
    const service = new TestService();

    for (const [key, Repository] of Object.entries(REPOSITORIES)) {
      expect(service[key as keyof typeof REPOSITORIES]).toBeInstanceOf(Repository);
    }
  });

  it('builds composed repositories from the same instances the service uses', () => {
    const service = new TestService();

    expect(service.dependencyOf('mailgunGateway')).toBe(service.emailTemplateRepository);
  });

  it('composes with an injected repository', () => {
    const emailTemplateRepository = new EmailTemplateRepository();
    const service = new TestService({ emailTemplateRepository });

    expect(service.emailTemplateRepository).toBe(emailTemplateRepository);
    expect(service.dependencyOf('mailgunGateway')).toBe(emailTemplateRepository);
  });
});
