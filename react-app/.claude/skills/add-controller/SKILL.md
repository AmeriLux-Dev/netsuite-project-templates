---
name: add-controller
description: Add a controller to this project (a Restlet or Suitelet script with named endpoints, its contract, DTOs, SDF object, scripts entry and client API module) so that npm run lint's structure check passes. Use when asked to add, create or scaffold a controller, restlet, suitelet, endpoint group or API for a record.
---

# Add a controller

A controller is one deployed script serving named endpoints, as in ASP.NET: `orders` with `list`, `byId`, `create`. Eight pieces make one, and `npm run lint` (through `scripts/checkStructure.mjs`) fails until all eight exist and agree. The `customers` controller is the reference for every file; read it before writing.

Ask for, or infer from the request: the controller name (camelCase, no `Controller` suffix: `orders`, `salesOrders`), each endpoint's name and HTTP method (`list:GET`, `byId:GET`, `create:POST`, `update:PUT`, `remove:DELETE`), the transport (Restlet by default; Suitelet when the caller is a NetSuite page rather than the SPA), and what each endpoint takes and returns.

## Rules that cannot bend

- The script id is `customscript_{{prefix}}_<snake_name>` and the deployment id `customdeploy_{{prefix}}_<snake_name>`, both at most 40 characters. `<snake_name>` is the controller name in snake_case (`salesOrders` gives `sales_orders`). They are written once, in `common/netsuite.ts`; everywhere else imports `scripts.<name>`.
- Endpoints speak DTOs from `common/dto/<name>.ts`, never entity types or records. The service maps entities to DTOs.
- A contract is declared once, in `common/types/<name>.ts`. Endpoint names in the contract, files under `endpoints/`, and the handlers bound in `endpoints/index.ts` are the same set.
- Endpoint names are camelCase and never `index` or `endpoint`.
- Nothing under `api/src/repositories/generated/`, `common/types/models.gen.ts` or `netsuite/FileCabinet/` is edited.

## The eight pieces, in order

`orders` / `Orders` / `Order` stand for the controller's name; the prefix, application name and title shown are already this project's values.

### 1. `common/netsuite.ts`: the scripts entry

Add one line above the `// @netsuite-project:scripts` marker inside `scripts`:

```ts
    orders: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_orders', deployId: 'customdeploy_{{prefix}}_orders' },
```

`kind` is `'suitelet'` for a Suitelet-served controller. Nothing else in this file changes.

### 2. `common/dto/orders.ts`: the wire shapes

One request and one response type per endpoint. Pick from the generated entity type so the DTO follows the model; GET parameters arrive as strings, so type them `number | string` and let the service parse. Add a model under `common/model/` first if the record has none (see HOW-TO-USE.md, "Adding a model"), then run `npm run generate`.

```ts
import type { SalesOrder } from '../types/models.gen';

export type OrderSummary = Pick<SalesOrder, 'id' | 'tranId' | 'total'>;

export interface OrderListRequest {
    search?: string;
    limit?: number | string;
}

export interface OrderListResponse {
    orders: OrderSummary[];
    limit: number;
}

export interface OrderByIdRequest {
    id: number | string;
}

export interface OrderCreateRequest {
    customerId: number;
    memo?: string;
}
```

### 3. `common/types/orders.ts`: the contract

```ts
import type { OrderByIdRequest, OrderCreateRequest, OrderListRequest, OrderListResponse, OrderSummary } from '../dto/orders';
import { defineContract } from './api';

/** The request and response of each endpoint of the orders controller. */
export interface OrdersEndpoints {
    list: { request: OrderListRequest; response: OrderListResponse };
    byId: { request: OrderByIdRequest; response: OrderSummary };
    create: { request: OrderCreateRequest; response: OrderSummary };
}

/** The orders controller's endpoints by name and method, shared by the script and the client. */
export const ordersContract = defineContract<OrdersEndpoints>({
    list: { method: 'GET' },
    byId: { method: 'GET' },
    create: { method: 'POST' },
});
```

One contract entry per line: the structure check reads them.

### 4. `api/src/controllers/orders/endpoints/<endpoint>.ts`: one file per endpoint

Thin: hand the request to a service, return its result. The file name is the endpoint name.

```ts
import type { OrderListRequest, OrderListResponse } from 'common/dto/orders';
import type { Endpoint } from '../../../lib/endpoint';
import { listOrders } from '../../../services/orders';

/** GET ?endpoint=list&search=&limit= */
export const list: Endpoint<OrderListRequest, OrderListResponse> = (request) => listOrders(request);
```

The service (`api/src/services/orders.ts`), repository functions (`api/src/repositories/orders.ts`) and specifications (`api/src/specifications/salesOrders.ts`) follow the customers example; a new service or repository function starts with a failing test under `api/__tests__/`.

### 5. `api/src/controllers/orders/endpoints/index.ts`: bind them

```ts
import { ordersContract } from 'common/types/orders';
import { defineEndpoints } from '../../../lib/endpoint';
import { byId } from './byId';
import { create } from './create';
import { list } from './list';

export const ordersEndpoints = defineEndpoints(ordersContract, { list, byId, create });
```

A handler missing from the object, or one whose types disagree with the contract, is a compile error.

### 6. `api/src/controllers/orders/ordersController.ts`: the script

The only transport-specific file. The JSDoc header makes it a deployed script; export exactly the HTTP methods the contract uses.

Restlet:

```ts
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { defineRestlet } from '../../lib/defineRestlet';
import { ordersEndpoints } from './endpoints';

const restlet = defineRestlet('orders', ordersEndpoints);

export const get = restlet.get;
export const post = restlet.post;
```

Suitelet (`@NScriptType Suitelet` in the header):

```ts
import { defineSuitelet } from '../../lib/defineSuitelet';
import { ordersEndpoints } from './endpoints';

export const onRequest = defineSuitelet('orders', ordersEndpoints);
```

### 7. `netsuite/Objects/customscript_{{prefix}}_orders.xml`: the SDF object

The file name is the script id. Restlet:

```xml
<restlet scriptid="customscript_{{prefix}}_orders">
  <description>Orders for {{appTitle}}.</description>
  <isinactive>F</isinactive>
  <name>{{appTitle}} Orders</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <notifyuser>F</notifyuser>
  <scriptfile>[/SuiteScripts/{{appName}}/api/controllers/orders/ordersController.js]</scriptfile>
  <scriptdeployments>
    <scriptdeployment scriptid="customdeploy_{{prefix}}_orders">
      <allemployees>F</allemployees>
      <allpartners>F</allpartners>
      <allroles>F</allroles>
      <audslctrole>ADMINISTRATOR</audslctrole>
      <isdeployed>T</isdeployed>
      <loglevel>DEBUG</loglevel>
      <status>RELEASED</status>
      <title>{{appTitle}} Orders</title>
    </scriptdeployment>
  </scriptdeployments>
</restlet>
```

Suitelet: `<suitelet scriptid=...>` ... `</suitelet>`, and the deployment gains `<eventtype></eventtype>`, `<isonline>F</isonline>` and `<runasrole></runasrole>` (copy `customscript_{{prefix}}_home.xml`).

### 8. `client/src/api/ordersApi.ts`: the typed client

```ts
import { scripts } from 'common/netsuite';
import { ordersContract } from 'common/types/orders';
import { createApiClient } from './apiClient';

/** One typed function per endpoint: `ordersApi.list({ search })`, `ordersApi.byId({ id })`, `ordersApi.create({...})`. */
export const ordersApi = createApiClient(scripts.orders, ordersContract);
```

A page never calls it directly: add a hook under `client/src/hooks/` (see `useCustomers.ts`) and a test under `client/__tests__/`.

## Finish

1. `npm run generate` if a model was added or changed.
2. `npm run typecheck`, `npm run lint`, `npm test`. Lint runs the structure check; fix what it names rather than working around it.
3. Say which endpoints exist and what remains unimplemented. Deploying (`npm run deploy`) is the person's call.

## Switching a controller between Restlet and Suitelet later

Change `@NScriptType` and the body of `<name>Controller.ts`, replace the SDF object's root element (and the three Suitelet-only deployment fields), and set `kind` on `scripts.<name>`. Endpoints, contract, DTOs and the client module do not change.
