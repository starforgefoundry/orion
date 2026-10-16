import type { MemberEmailTrigger, MemberEmailType } from '$lib/member_enums';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { desc, eq } from 'drizzle-orm';

export class MemberEmailRepository extends BaseRepository {
  async log(memberId: string, type: MemberEmailType, trigger: MemberEmailTrigger) {
    const [logged] = await this.db
      .insert(schema.memberEmail)
      .values({ memberId, type, trigger })
      .returning();
    return logged;
  }

  async listByMember(memberId: string) {
    return await this.db
      .select()
      .from(schema.memberEmail)
      .where(eq(schema.memberEmail.memberId, memberId))
      .orderBy(desc(schema.memberEmail.sentDate));
  }
}
