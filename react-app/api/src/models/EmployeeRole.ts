import { Field, InternalId, RecordType } from '@amerilux/netsuite-repository';

/**
 * One role assignment of an employee, read from the `employeerolesforsearch` query type: a row per
 * employee and role, with the role's name as the display text of `role`. There is no record behind
 * it, so the set is only ever listed through a specification (never found by id, never written), and
 * only a role allowed to read role assignments can query it; see the userRoles controller.
 * Run `npm run generate` after editing: it refreshes api/src/repositories/generated/ and api/src/types/models.gen.ts.
 */
@RecordType('employeerolesforsearch')
export class EmployeeRole {
    @InternalId()
    @Field('role')
    roleId!: number;

    @Field('entity')
    employeeId!: number;

    @Field({ queryFieldId: 'role', text: true })
    roleName!: string;
}
