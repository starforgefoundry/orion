import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import type { EmailTemplateKey } from '$lib/utils/email_templates';
import { eq } from 'drizzle-orm';

export class EmailTemplateRepository extends BaseRepository {
  async getAll() {
    return await this.db.select().from(schema.emailTemplate);
  }

  async get(key: EmailTemplateKey) {
    const [template] = await this.db
      .select()
      .from(schema.emailTemplate)
      .where(eq(schema.emailTemplate.key, key));
    return template;
  }

  async update(key: EmailTemplateKey, content: { subject: string; body: string }) {
    const [template] = await this.db
      .update(schema.emailTemplate)
      .set(content)
      .where(eq(schema.emailTemplate.key, key))
      .returning();
    return template;
  }
}
