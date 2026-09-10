import { Field, ReadOnly, RecordType } from '@amerilux/netsuite-repository';
import { netsuite } from '../../../common/netsuite';

/**
 * The customer record, as much of it as this application reads. Every declared property
 * is a mapped field; `@Field` only where the property name differs from the field id.
 * Run `npm run generate` after editing to refresh src/repositories/generated/.
 */
@RecordType(netsuite.customer)
export class Customer {
    @ReadOnly() id!: number;
    @Field(netsuite.customerCompanyName) companyName!: string;
    @Field(netsuite.customerEmail) email!: string | null;
}
