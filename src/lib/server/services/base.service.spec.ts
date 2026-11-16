import { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import { BaseService, REPOSITORIES } from '$lib/server/services/base.service';
import { describe, expect, it } from 'vitest';

describe(BaseService.name, () => {
  it('gives the service one instance of every registered repository', () => {
    const service = new BaseService();

    for (const [key, Repository] of Object.entries(REPOSITORIES)) {
      expect(service[key as keyof typeof REPOSITORIES]).toBeInstanceOf(Repository);
    }
  });

  it('uses an injected repository instead of building one', () => {
    const emailTemplateRepository = new EmailTemplateRepository();
    const service = new BaseService({ emailTemplateRepository });

    expect(service.emailTemplateRepository).toBe(emailTemplateRepository);
  });
});
