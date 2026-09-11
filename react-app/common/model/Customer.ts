import { Field, ReadOnly, RecordType } from '@amerilux/netsuite-repository';

/**
 * The customer record, as much of it as this application reads. The model is the declaration of
 * the record: the record type and every field id it touches live here, not in common/netsuite.ts.
 * Every declared property is a mapped field; `@Field` only where the property name differs from
 * the field id. Run `npm run generate` after editing: it refreshes api/src/repositories/generated/ and the
 * shared entity types in common/types/models.gen.ts.
 */
@RecordType('customer')
export class Customer {
    @ReadOnly() id!: number;

    @Field('companyname')
    companyName!: string;

    email!: string | null;
}
