#!/usr/bin/env node
/**
 * Snippet check for the react-app template. Every snippet in react-app/.vscode/netsuite-project.code-snippets is
 * expanded the way VS Code would expand it (the file name in, every tab stop filled with a sample value) and
 * written into an installed scaffold as one coherent addition: an `orders` Restlet and an `orderTotals` Suitelet,
 * the `SalesOrder` model, specification, repositories and service behind them, their tests, a hook, a mutation,
 * a page and a route. Then `npm run generate`, the route tree generator, `npm run typecheck` (tsc in every
 * workspace, tests included) and the structure check run over the result. ESLint is not run: the check proves
 * that the snippets compile and fit together, which is what a stale snippet breaks first.
 *
 * Every snippet must have a step in the scenario below; a snippet without one fails the check, so a snippet
 * cannot be added without saying what it is supposed to produce.
 *
 *   node scripts/checkSnippets.mjs --project <dir>              # an installed scaffold (the e2e passes its own)
 *   node scripts/checkSnippets.mjs --project <dir> --keep       # leave the expanded files in place for inspection
 *   node scripts/checkSnippets.mjs --project <dir> --snippets <file>
 *                                                               # default: react-app/.vscode/netsuite-project.code-snippets
 *
 * The files the check writes are removed afterwards (edited files restored, the generated modules refreshed),
 * so the scaffold is left as it was found.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templatesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

// ── VS Code snippet syntax ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Parses a snippet body into nodes: text, tab stops (`$1`, `${1}`, `${1:default}`, `${1|a,b|}`, `${1/re/fmt/g}`)
 * and variables (`$NAME`, `${NAME:default}`, `${NAME/re/fmt/g}`). The grammar is VS Code's; the escapes are
 * `\$`, `\}` and `\\` in text, `\,` and `\|` in a choice, `\/` inside a transform.
 */
function parseSnippet(text) {
    let position = 0;

    function parseSequence(insidePlaceholder) {
        const nodes = [];
        let literal = '';
        const flushLiteral = () => {
            if (literal !== '') nodes.push({ type: 'text', value: literal });
            literal = '';
        };
        while (position < text.length) {
            const character = text[position];
            if (character === '\\' && position + 1 < text.length && '$}\\'.includes(text[position + 1])) {
                literal += text[position + 1];
                position += 2;
                continue;
            }
            if (character === '}' && insidePlaceholder) {
                flushLiteral();
                return nodes;
            }
            if (character === '$') {
                const node = parseDollar();
                if (node) {
                    flushLiteral();
                    nodes.push(node);
                    continue;
                }
            }
            literal += character;
            position += 1;
        }
        flushLiteral();
        if (insidePlaceholder) throw new Error(`Unterminated placeholder in snippet body: ${text}`);
        return nodes;
    }

    /** At a `$`: a tab stop or variable in any of its forms, or undefined when the `$` is plain text. */
    function parseDollar() {
        const rest = text.slice(position + 1);
        let match = rest.match(/^(\d+)/);
        if (match) {
            position += 1 + match[0].length;
            return { type: 'tabstop', index: Number(match[1]) };
        }
        match = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
        if (match) {
            position += 1 + match[0].length;
            return { type: 'variable', name: match[1] };
        }
        if (rest[0] !== '{') return undefined;
        match = rest.slice(1).match(/^(\d+)|^([A-Za-z_][A-Za-z0-9_]*)/);
        if (!match) return undefined;
        position += 2 + match[0].length;
        const node = match[1] !== undefined ? { type: 'tabstop', index: Number(match[1]) } : { type: 'variable', name: match[2] };
        const next = text[position];
        if (next === '}') {
            position += 1;
            return node;
        }
        if (next === ':') {
            position += 1;
            node.children = parseSequence(true);
            position += 1;
            return node;
        }
        if (next === '|' && node.type === 'tabstop') {
            position += 1;
            node.type = 'choice';
            node.options = parseChoiceOptions();
            return node;
        }
        if (next === '/') {
            position += 1;
            node.transform = parseTransform();
            return node;
        }
        throw new Error(`Unexpected "${next}" after "${text.slice(position - match[0].length - 2, position)}" in snippet body: ${text}`);
    }

    function parseChoiceOptions() {
        const options = [];
        let current = '';
        while (position < text.length) {
            const character = text[position];
            if (character === '\\' && ',|\\'.includes(text[position + 1] ?? '')) {
                current += text[position + 1];
                position += 2;
                continue;
            }
            if (character === ',') {
                options.push(current);
                current = '';
                position += 1;
                continue;
            }
            if (character === '|' && text[position + 1] === '}') {
                options.push(current);
                position += 2;
                return options;
            }
            current += character;
            position += 1;
        }
        throw new Error(`Unterminated choice in snippet body: ${text}`);
    }

    /**
     * Reads up to the next unescaped `/`, turning `\/` into `/` and keeping every other escape as written. In the
     * format section a `/` inside `${1:/upcase}` is a modifier, not the terminator, so braces are tracked there.
     */
    function readTransformSection(trackBraces) {
        let section = '';
        let depth = 0;
        while (position < text.length) {
            const character = text[position];
            if (character === '\\' && text[position + 1] === '/') {
                section += '/';
                position += 2;
                continue;
            }
            if (character === '\\' && position + 1 < text.length) {
                section += character + text[position + 1];
                position += 2;
                continue;
            }
            if (trackBraces && character === '$' && text[position + 1] === '{') {
                depth += 1;
                section += '${';
                position += 2;
                continue;
            }
            if (trackBraces && character === '}' && depth > 0) depth -= 1;
            if (character === '/' && depth === 0) {
                position += 1;
                return section;
            }
            section += character;
            position += 1;
        }
        throw new Error(`Unterminated transform in snippet body: ${text}`);
    }

    function parseTransform() {
        const regexSource = readTransformSection(false);
        const formatSource = readTransformSection(true);
        let flags = '';
        while (position < text.length && text[position] !== '}') {
            flags += text[position];
            position += 1;
        }
        position += 1;
        return { regex: new RegExp(regexSource, flags), format: parseFormat(formatSource) };
    }

    return parseSequence(false);
}

/** The replacement side of a transform: text, `$1`, `${1}`, `${1:/upcase}`, `${1:+if}`, `${1:?if:else}`, `${1:-else}`, `${1:else}`. */
function parseFormat(source) {
    const parts = [];
    const token = /\$(\d+)|\$\{(\d+)(?::(\/upcase|\/downcase|\/capitalize|\/camelcase|\/pascalcase)|:\+([^}]*)|:\?([^:}]*):([^}]*)|:-([^}]*)|:([^}]*))?\}/g;
    const unescape = (text) => text.replace(/\\([$}\\])/g, '$1');
    let last = 0;
    for (const match of source.matchAll(token)) {
        if (match.index > last) parts.push({ text: unescape(source.slice(last, match.index)) });
        const group = Number(match[1] ?? match[2]);
        if (match[3] !== undefined) parts.push({ group, modifier: match[3].slice(1) });
        else if (match[4] !== undefined) parts.push({ group, ifText: unescape(match[4]) });
        else if (match[5] !== undefined) parts.push({ group, ifText: unescape(match[5]), elseText: unescape(match[6]) });
        else if (match[7] !== undefined) parts.push({ group, elseText: unescape(match[7]) });
        else if (match[8] !== undefined) parts.push({ group, elseText: unescape(match[8]) });
        else parts.push({ group });
        last = match.index + match[0].length;
    }
    if (last < source.length) parts.push({ text: unescape(source.slice(last)) });
    return parts;
}

function applyModifier(value, modifier) {
    switch (modifier) {
        case 'upcase': return value.toUpperCase();
        case 'downcase': return value.toLowerCase();
        case 'capitalize': return value.charAt(0).toUpperCase() + value.slice(1);
        case 'pascalcase': return value.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
        case 'camelcase': {
            const pascal = applyModifier(value, 'pascalcase');
            return pascal.charAt(0).toLowerCase() + pascal.slice(1);
        }
        default: return value;
    }
}

function applyTransform(value, transform) {
    return value.replace(transform.regex, (...replaceArguments) => {
        // (match, group1, ..., offset, input): named groups would add a trailing object, and no snippet here uses them.
        const groups = replaceArguments.slice(0, replaceArguments.length - 2);
        return transform.format.map((part) => {
            if (part.text !== undefined) return part.text;
            const group = groups[part.group];
            if (part.modifier) return group === undefined ? '' : applyModifier(group, part.modifier);
            if (part.ifText !== undefined) return group !== undefined && group !== '' ? part.ifText : (part.elseText ?? '');
            if (part.elseText !== undefined) return group !== undefined && group !== '' ? group : part.elseText;
            return group ?? '';
        }).join('');
    });
}

/**
 * Renders a snippet as VS Code would once the tab stops are left as given: `values` (by tab stop index) stand for
 * what the developer typed; every other tab stop keeps its default text, which is the first placeholder of that
 * index that has one, and a choice takes its first option. `$0` is the final cursor and renders as nothing.
 */
function expandSnippet(body, { fileNameBase, values = {} }) {
    const nodes = parseSnippet(Array.isArray(body) ? body.join('\n') : body);
    const defaults = new Map();
    (function collectDefaults(list) {
        for (const node of list) {
            if (node.type === 'tabstop' && node.children && node.children.length > 0 && !defaults.has(node.index)) defaults.set(node.index, node.children);
            if (node.type === 'choice' && !defaults.has(node.index)) defaults.set(node.index, [{ type: 'text', value: node.options[0] ?? '' }]);
            if (node.children) collectDefaults(node.children);
        }
    })(nodes);
    const variables = { TM_FILENAME_BASE: fileNameBase, TM_FILENAME: `${fileNameBase}.ts` };
    const resolving = new Set();

    function resolveTabstop(index) {
        if (values[index] !== undefined) return String(values[index]);
        if (index === 0) return '';
        const children = defaults.get(index);
        if (!children) return '';
        if (resolving.has(index)) throw new Error(`Tab stop ${index} refers to itself.`);
        resolving.add(index);
        const rendered = render(children);
        resolving.delete(index);
        return rendered;
    }

    function render(list) {
        return list.map((node) => {
            switch (node.type) {
                case 'text': return node.value;
                case 'tabstop':
                case 'choice': {
                    const value = resolveTabstop(node.index);
                    return node.transform ? applyTransform(value, node.transform) : value;
                }
                case 'variable': {
                    const value = variables[node.name];
                    if (value === undefined) return node.children ? render(node.children) : node.name;
                    return node.transform ? applyTransform(value, node.transform) : value;
                }
                default: throw new Error(`Unknown node type ${node.type}`);
            }
        }).join('');
    }

    return render(nodes);
}

// ── the scenario: what a developer would type ─────────────────────────────────────────────────────────────────────

/**
 * One coherent addition to the scaffold, built from every snippet. A `file` step expands a snippet into a new
 * file (its name is what VS Code derives the names from). An `into` step expands a fragment snippet and inserts it
 * into a file written earlier: before the first line matching `beforeLine` (or the last one matching
 * `beforeLastLine`, indented one level further when `indent` says so), at the first match of `at` (a
 * zero-width regex, with `prefix` written first), or appended. An `edit` step is what the snippet's description
 * tells the developer to do by hand (extend an import, call the guard). A `run` step runs one of the project's
 * npm scripts, for a setup step the snippets assume has happened (`add:jobs`); what it creates is named in
 * `creates`, so the restore takes those files away again. Paths and values may carry the template tokens
 * {{prefix}}, {{appName}} and {{appTitle}}; they are rendered from the scaffold's netsuite.ts.
 */
const scenario = [
    // The record behind everything: a sales order with its transaction number and customer.
    { snippet: 'nspModel', file: 'api/src/models/SalesOrder.ts', values: { 5: 'One sales order: its transaction number and customer' } },
    { snippet: 'nspModelField', into: 'api/src/models/SalesOrder.ts', beforeLine: /^}$/, indent: '    ', values: { 1: 'entity', 2: 'customerId', 3: 'number' } },
    // A custom record with every decorator fragment, its subrecord class and its line class (nspModel plus the key and parent-id fragments); a model with every decorator at once; an abstract base.
    { snippet: 'nspModelSubrecordClass', file: 'api/src/models/FulfillmentContentAddress.ts', values: { 1: 'Where the content ships' } },
    // A sublist line is a record type like any other: nspModel, then the key and the parent id from the two fragments.
    { snippet: 'nspModel', file: 'api/src/models/FulfillmentContentLine.ts', values: { 1: "'customrecord_fulfillment_content_line'", 2: 'custrecord_line_item', 3: 'itemId', 4: 'number', 5: 'One line of a fulfillment content' } },
    { edit: 'api/src/models/FulfillmentContentLine.ts', find: "import { Field, NetsuiteRecordType, RecordType } from '@amerilux/netsuite-repository';", replace: "import { Field, InternalId, ParentId, ReadOnly, RecordType } from '@amerilux/netsuite-repository';" },
    { edit: 'api/src/models/FulfillmentContentLine.ts', find: '    id!: number;\n\n', replace: '' },
    { snippet: 'nspModelInternalId', into: 'api/src/models/FulfillmentContentLine.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_line_id', 2: 'id', 3: 'lineId' } },
    { snippet: 'nspModelParentId', into: 'api/src/models/FulfillmentContentLine.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_line_content', 2: 'fulfillmentContentId' } },
    { snippet: 'nspModelBase', file: 'api/src/models/TransactionBase.ts' },
    { snippet: 'nspHelpModel', file: 'api/src/models/Invoice.ts', values: { 1: 'SalesOrder', 5: 'createdfrom', 6: 'salesOrder', 7: 'id', 8: 'tranId' } },
    { snippet: 'nspModel', file: 'api/src/models/FulfillmentContent.ts', values: { 1: "'customrecord_fulfillment_content'", 2: 'custrecord_content_sku', 3: 'sku', 4: 'string', 5: 'One content line of a fulfillment' } },
    { edit: 'api/src/models/FulfillmentContent.ts', find: "import { Field, NetsuiteRecordType, RecordType } from '@amerilux/netsuite-repository';", replace: "import { ExcludeFromDefaultSelect, Field, NotMapped, ReadOnly, RecordType, SetFirst, Sublist, Subrecord, Transform } from '@amerilux/netsuite-repository';\nimport type { EmployeeRole } from './EmployeeRole';\nimport type { FulfillmentContentAddress } from './FulfillmentContentAddress';\nimport type { FulfillmentContentLine } from './FulfillmentContentLine';\n\nexport function trimText(value: unknown): string {\n    return String(value ?? '').trim();\n}" },
    { snippet: 'nspModelFieldText', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_status' } },
    { snippet: 'nspModelFieldSelect', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_location', 2: 'locationId' } },
    { snippet: 'nspModelFieldSplit', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_state', 2: 'custrecord_content_status', 3: 'state' } },
    { snippet: 'nspModelReadOnly', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_total', 2: 'total' } },
    { snippet: 'nspModelReference', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_packer', 2: 'packer', 3: 'EmployeeRole', 4: 'roleId', 5: 'roleName' } },
    { snippet: 'nspModelSubrecord', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'shipaddresslist', 2: 'shippingAddress', 3: 'Where the content ships', 4: 'FulfillmentContentAddress' } },
    { snippet: 'nspModelSublist', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'recmachcustrecord_line_content', 2: 'customrecord_fulfillment_content', 3: 'recmachcustrecord_line_content', 5: 'FulfillmentContentLine' } },
    { snippet: 'nspModelTransform', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 2: 'custrecord_content_po' } },
    { snippet: 'nspModelNotMapped', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ' },
    { snippet: 'nspModelSetFirst', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_carrier', 2: 'string | null' } },
    { snippet: 'nspModelExcludeFromDefaultSelect', into: 'api/src/models/FulfillmentContent.ts', beforeLastLine: /^}$/, indent: '    ', values: { 1: 'custrecord_content_notes' } },

    { snippet: 'nspSpecification', file: 'api/src/specifications/salesOrdersSpecifications.ts', values: { 2: 'forCustomer', 3: 'customerId', 5: 'customerId', 6: 'sales orders' } },
    { snippet: 'nspRepository', file: 'api/src/repositories/salesOrdersRepository.ts', values: { 3: 'forCustomer', 4: 'sales orders', 5: 'Every sales order of the customer, in no particular order', 6: 'customerId' } },
    { edit: 'api/src/repositories/salesOrdersRepository.ts', find: "import type { SalesOrder } from '../types/models.gen';", replace: "import type { SalesOrder, SalesOrderCreate, SalesOrderPatch } from '../types/models.gen';" },
    { snippet: 'nspRepositoryCreate', into: 'api/src/repositories/salesOrdersRepository.ts', append: true, values: { 1: 'Creates a sales order' } },
    { snippet: 'nspRepositoryUpdate', into: 'api/src/repositories/salesOrdersRepository.ts', append: true, values: { 1: 'Changes the fields of one sales order', 2: 'amend' } },

    // The service both controllers call.
    { snippet: 'nspService', file: 'api/src/services/ordersService.ts', values: { 1: 'SalesOrder', 2: 'listSalesOrdersByCustomerId', 3: 'salesOrders', 4: 'sales orders', 5: 'tranId', 7: 'Every sales order of the customer, summarized', 8: 'getOrdersByCustomer', 9: 'customerId' } },

    // The orders Restlet: a byCustomer endpoint from the file snippet, a create endpoint added with the fragments, a guard and authorize.
    { snippet: 'nspControllerRestlet', file: 'api/src/controllers/ordersController.ts', values: { 1: 'byCustomer', 2: 'getOrdersByCustomer', 3: 'SalesOrderSummary', 5: 'customerId', 7: 'orders', 8: 'a customer\'s sales orders' } },
    { edit: 'api/src/controllers/ordersController.ts', find: "import { defineEndpoints, defineRestlet } from '@amerilux/netsuite-api/server';", replace: "import { ApiError, defineEndpoints, defineRestlet } from '@amerilux/netsuite-api/server';" },
    { snippet: 'nspControllerParse', into: 'api/src/controllers/ordersController.ts', beforeLine: /^export const ordersEndpoints = defineEndpoints\(\{$/, values: { 1: 'customerId' } },
    { edit: 'api/src/controllers/ordersController.ts', find: 'const customerId = request.customerId;', replace: 'const customerId = parseCustomerId(request.customerId);' },
    { snippet: 'nspControllerShapes', into: 'api/src/controllers/ordersController.ts', beforeLine: /^export const ordersEndpoints = defineEndpoints\(\{$/, values: { 1: 'Create', 2: 'customerId', 4: 'orders', 5: 'SalesOrderSummary' } },
    { snippet: 'nspControllerEndpoint', into: 'api/src/controllers/ordersController.ts', beforeLine: /^\}\);$/, indent: '    ', values: { 1: 'create', 4: 'customerId', 5: 'orders', 6: 'getOrdersByCustomer', 7: 'Creates nothing yet: answers the customer\'s orders' } },
    { snippet: 'nspControllerAuthorize', into: 'api/src/controllers/ordersController.ts', at: /(?<=, ordersEndpoints)(?=\);)/, prefix: ', ', values: { 1: "endpoint === 'create' && typeof request.customerId !== 'number'" } },
    { snippet: 'nspObjectRestlet', file: 'netsuite/Objects/customscript_{{prefix}}_orders.xml', values: { 1: 'Orders', 2: 'Lists a customer\'s sales orders' } },

    // The orderTotals Suitelet (server-only), read by a repository through its Suitelet client.
    { snippet: 'nspControllerSuitelet', file: 'api/src/controllers/orderTotalsController.ts', values: { 1: 'byCustomer', 2: 'getOrdersByCustomer', 3: 'SalesOrderSummary', 4: 'orders', 5: 'customerId', 7: 'orders', 8: 'order totals per customer' } },
    { snippet: 'nspObjectSuitelet', file: 'netsuite/Objects/customscript_{{prefix}}_order_totals.xml', values: { 1: 'Order Totals', 2: 'Totals per customer' } },
    { snippet: 'nspRepositorySuitelet', file: 'api/src/repositories/orderTotalsRepository.ts', values: { 1: 'ByCustomerResponse', 4: 'Order totals', 5: 'listOrderTotalsForCustomer', 6: 'customerId', 8: 'orders', 9: 'byCustomer' } },

    // A repository over a NetSuite module, with a log line.
    { snippet: 'nspRepositoryModule', file: 'api/src/repositories/currentScriptRepository.ts', values: { 2: 'the running script', 3: 'CurrentScript', 4: 'id', 5: 'string', 6: 'readCurrentScript', 7: 'script', 8: 'getCurrentScript()', 9: 'script.id' } },
    { edit: 'api/src/repositories/currentScriptRepository.ts', find: "import * as runtime from 'N/runtime';", replace: "import * as log from 'N/log';\nimport * as runtime from 'N/runtime';" },
    { snippet: 'nspRepositoryLog', into: 'api/src/repositories/currentScriptRepository.ts', beforeLine: /^\s+return \{ id: script\.id \};$/, values: { 2: 'script read', 3: 'id: script.id' } },

    // Ids no controller or model owns.
    { snippet: 'nspNetsuiteIds', into: 'netsuite.ts', append: true, values: { 1: 'Saved searches the reports read', 2: 'savedSearches', 3: 'openOrders', 4: 'customsearch_{{prefix}}_open_orders' } },

    // Tests, one per layer.
    { snippet: 'nspTestController', file: 'api/__tests__/controllers/ordersController.test.ts', values: { 1: 'SalesOrderSummary', 3: 'getOrdersByCustomer', 4: 'customerId', 6: 'byCustomer', 7: "{ tranId: 'SO1' }", 9: 'orders' } },
    { snippet: 'nspTestService', file: 'api/__tests__/services/ordersService.test.ts', values: { 1: 'SalesOrder', 2: 'listSalesOrdersByCustomerId', 3: 'customerId', 5: 'salesOrders', 6: 'getOrdersByCustomer', 7: 'the transaction number', 8: "{ id: 1, tranId: 'SO1', customerId: 7 }", 9: "{ tranId: 'SO1' }" } },
    { snippet: 'nspTestRepository', file: 'api/__tests__/repositories/salesOrdersRepository.test.ts', values: { 3: 'listSalesOrdersByCustomerId', 4: "[{ id: 1, tranId: 'SO1', customerId: 7 }]", 6: 'the customer', 7: 'customerId' } },
    { snippet: 'nspTestRepositorySuitelet', file: 'api/__tests__/repositories/orderTotalsRepository.test.ts', values: { 2: 'byCustomer', 3: 'listOrderTotalsForCustomer', 4: 'customerId', 5: 'orders', 6: "[{ tranId: 'SO1' }]" } },
    { snippet: 'nspTestHook', file: 'client/__tests__/ordersQuery.test.ts', values: { 2: 'byCustomer', 3: '{ customerId: 7, orders: [] }', 4: 'ordersByCustomer', 8: '{ customerId: 7 }' } },

    // The client: two query hooks, a mutation, a page and its route.
    { snippet: 'nspHookQueryWith', file: 'client/src/hooks/useOrdersByCustomer.ts', values: { 1: 'orders', 2: 'byCustomer', 3: 'customerId', 5: 'Every sales order of the customer' } },
    { snippet: 'nspHookQuery', file: 'client/src/hooks/useSignedInUserRoles.ts', values: { 1: 'user', 2: 'roles', 3: 'The caller and every role assigned to them' } },
    { snippet: 'nspHookMutation', file: 'client/src/hooks/useCreateOrder.ts', values: { 1: 'orders', 2: 'create', 3: 'Creates a sales order' } },
    { snippet: 'nspPage', file: 'client/src/pages/OrdersPage.tsx', values: { 1: 'useOrdersByCustomer', 2: 'The customer\'s sales orders', 4: '7', 5: 'Orders' } },
    { snippet: 'nspRoute', file: 'client/src/routes/orders.tsx' },

    // Jobs: the run machinery a project adds once, then a job, its object, and the repository that starts it.
    {
        run: 'add:jobs',
        creates: [
            'netsuite/Objects/customrecord_{{prefix}}_job_run.xml',
            'netsuite/Objects/customscript_{{prefix}}_job_cleanup_mr.xml',
            'netsuite/Objects/customscript_{{prefix}}_job_runs.xml',
            'api/src/jobs/jobRunCleanup.ts',
            'api/src/repositories/jobRunRepository.ts',
            'api/src/services/jobRunService.ts',
            'api/src/controllers/jobRunsController.ts',
            'client/src/hooks/useJobRun.ts',
            'netsuite-api.config.json',
        ],
    },
    // What the job's stages call, and the shapes on either end of a run: the service owns both, so the service
    // that starts a run and the stages that do the work speak the same types.
    {
        edit: 'api/src/services/ordersService.ts',
        find: "export type SalesOrderSummary = Pick<SalesOrder, 'tranId'>;",
        replace: [
            "export type SalesOrderSummary = Pick<SalesOrder, 'tranId'>;",
            '',
            '/** What a run of the closeOldOrders job is asked to do. */',
            'export interface CloseOldOrdersRequest {',
            '    olderThanDays: number;',
            '}',
            '',
            '/** What such a run leaves behind. */',
            'export interface CloseOldOrdersResult {',
            '    closed: number;',
            '}',
            '',
            '/** The ids of the orders old enough to close. */',
            'export function listOldOrderIds(olderThanDays: number): number[] {',
            '    return olderThanDays > 0 ? [] : [];',
            '}',
            '',
            'export function closeOrder(orderId: number): void {',
            "    if (orderId <= 0) throw new Error('An order id is a positive number.');",
            '}',
        ].join('\n'),
    },
    {
        snippet: 'nspJob',
        file: 'api/src/jobs/closeOldOrders.ts',
        values: { 1: 'CloseOldOrdersRequest', 2: 'CloseOldOrdersResult', 3: 'listOldOrderIds', 4: 'closeOrder', 5: 'orders', 6: 'closes sales orders older than a cutoff', 7: 'number', 8: 'olderThanDays', 9: 'orderId', 10: 'closed' },
    },
    { snippet: 'nspJobParameter', into: 'api/src/jobs/closeOldOrders.ts', beforeLine: /^\s+runs: jobRuns,$/, values: { 1: 'batchSize', 2: 'batch_size', 3: 'integer' } },
    { snippet: 'nspJobReduce', into: 'api/src/jobs/closeOldOrders.ts', beforeLine: /^\s+summarize: \(summary/, values: { 1: 'orderId', 2: 'counts', 3: 'number', 4: 'length' } },
    // What the reduce snippet's description says to do by hand: NetSuite runs the stages the file exports.
    { edit: 'api/src/jobs/closeOldOrders.ts', find: 'export const { getInputData, map, summarize }', replace: 'export const { getInputData, map, reduce, summarize }' },
    { snippet: 'nspObjectMapReduce', file: 'netsuite/Objects/customscript_{{prefix}}_close_old_orders_mr.xml', values: { 1: 'Close Old Orders', 2: 'Closes sales orders older than a cutoff' } },
    // Every parameter the job declares needs its field on the object; the structure check says so otherwise.
    {
        edit: 'netsuite/Objects/customscript_{{prefix}}_close_old_orders_mr.xml',
        find: '  </scriptcustomfields>',
        replace: [
            '    <scriptcustomfield scriptid="custscript_{{prefix}}_batch_size">',
            '      <accesslevel>2</accesslevel>',
            '      <defaultvalue>100</defaultvalue>',
            '      <description>How many orders one run closes.</description>',
            '      <displaytype>NORMAL</displaytype>',
            '      <fieldtype>INTEGER</fieldtype>',
            '      <isformula>F</isformula>',
            '      <ismandatory>F</ismandatory>',
            '      <label>Batch Size</label>',
            '      <searchlevel>2</searchlevel>',
            '      <storevalue>T</storevalue>',
            '    </scriptcustomfield>',
            '  </scriptcustomfields>',
        ].join('\n'),
    },
    { snippet: 'nspRepositoryJob', file: 'api/src/repositories/orderJobsRepository.ts', values: { 1: 'closeOldOrders', 2: 'CloseOldOrdersRequest', 3: 'orders' } },

    // Events: self-contained SuiteScript, with no SDF object of their own.
    {
        snippet: 'nspUserEvent',
        file: 'api/src/events/user/salesOrder.ts',
        values: { 1: 'Sales Order', 2: 'memo', 3: 'memo', 4: 'listSalesOrdersByCustomerId', 5: 'salesOrders', 6: 'Stamps the memo when a sales order is saved' },
    },
    { snippet: 'nspClientEvent', file: 'api/src/events/client/salesOrder.ts', values: { 1: 'sales order', 2: 'quantity', 3: 'quantity', 4: 'Warns when the quantity is not a positive number' } },
];

// ── running it ───────────────────────────────────────────────────────────────────────────────────────────────────

function readFlag(flag) {
    const index = process.argv.indexOf(flag);
    return index === -1 ? undefined : process.argv[index + 1];
}

const projectDir = readFlag('--project') && path.resolve(readFlag('--project'));
const snippetsPath = path.resolve(readFlag('--snippets') ?? path.join(templatesRoot, 'react-app', '.vscode', 'netsuite-project.code-snippets'));
const keep = process.argv.includes('--keep');
if (!projectDir || !existsSync(path.join(projectDir, 'netsuite.ts')) || !existsSync(path.join(projectDir, 'node_modules'))) {
    console.error('--project must name an installed scaffold of the react-app template (netsuite.ts and node_modules present).');
    process.exit(1);
}

/** The template tokens the snippet file carries, rendered from the scaffold as the CLI rendered them. */
function readTemplateTokens() {
    const source = readFileSync(path.join(projectDir, 'netsuite.ts'), 'utf8');
    const read = (property) => source.match(new RegExp(`^\\s*${property}:\\s*'([^']*)'`, 'm'))?.[1];
    const tokens = { prefix: read('prefix'), appName: read('folder'), appTitle: read('title') };
    for (const [name, value] of Object.entries(tokens)) {
        if (!value) throw new Error(`Could not read ${name} from ${projectDir}/netsuite.ts.`);
    }
    return tokens;
}

const templateTokens = readTemplateTokens();
const renderTokens = (text) => text.replace(/\{\{(prefix|appName|appTitle)\}\}/g, (_, token) => templateTokens[token]);

const snippets = JSON.parse(readFileSync(snippetsPath, 'utf8').replace(/^﻿/, ''));
const snippetNames = Object.keys(snippets);
const scenarioSnippets = new Set(scenario.filter((step) => step.snippet).map((step) => step.snippet));
const uncovered = snippetNames.filter((name) => !scenarioSnippets.has(name));
const unknown = [...scenarioSnippets].filter((name) => !snippetNames.includes(name));
if (uncovered.length > 0 || unknown.length > 0) {
    if (uncovered.length > 0) console.error(`Snippets without a step in scripts/checkSnippets.mjs: ${uncovered.join(', ')}. Add a step so the check covers them.`);
    if (unknown.length > 0) console.error(`Steps naming snippets that do not exist: ${unknown.join(', ')}.`);
    process.exit(1);
}

/** Original contents of every file the scenario touches (undefined when the file did not exist), for the restore. */
const originals = new Map();
const routeTreePath = path.join(projectDir, 'client', 'src', 'routeTree.gen.ts');

function rememberOriginal(relativePath) {
    const absolutePath = path.join(projectDir, relativePath);
    if (!originals.has(relativePath)) originals.set(relativePath, existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined);
}

function readProjectFile(relativePath) {
    return readFileSync(path.join(projectDir, relativePath), 'utf8');
}

function writeProjectFile(relativePath, content) {
    const absolutePath = path.join(projectDir, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
}

function expandStep(step, fileNameBase) {
    const snippet = snippets[step.snippet];
    const values = Object.fromEntries(Object.entries(step.values ?? {}).map(([index, value]) => [index, renderTokens(String(value))]));
    return expandSnippet(renderTokens(Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body), { fileNameBase, values });
}

function insertFragment(source, fragment, step) {
    const lineEnding = source.includes('\r\n') ? '\r\n' : '\n';
    const normalized = source.replace(/\r\n/g, '\n');
    const fragmentLines = fragment.split('\n');
    let result;
    if (step.beforeLine || step.beforeLastLine) {
        const lines = normalized.split('\n');
        const anchor = step.beforeLine ? lines.findIndex((line) => step.beforeLine.test(line)) : lines.findLastIndex((line) => step.beforeLastLine.test(line));
        if (anchor === -1) throw new Error(`${step.into}: no line matches ${step.beforeLine ?? step.beforeLastLine} for ${step.snippet}.`);
        // Where the developer would put the cursor: the anchor line's indentation, plus one level when the step says so.
        const indentation = lines[anchor].match(/^\s*/)[0] + (step.indent ?? '');
        lines.splice(anchor, 0, ...fragmentLines.map((line) => (line === '' ? line : indentation + line)));
        result = lines.join('\n');
    } else if (step.at) {
        const match = step.at.exec(normalized);
        if (!match) throw new Error(`${step.into}: nothing matches ${step.at} for ${step.snippet}.`);
        const lineStart = normalized.lastIndexOf('\n', match.index) + 1;
        const indentation = normalized.slice(lineStart).match(/^\s*/)[0];
        const [first, ...rest] = fragmentLines;
        const text = [first, ...rest.map((line) => (line === '' ? line : indentation + line))].join('\n');
        result = normalized.slice(0, match.index) + (step.prefix ?? '') + text + normalized.slice(match.index);
    } else if (step.append) {
        result = `${normalized.replace(/\n*$/, '')}\n\n${fragment}`;
    } else {
        throw new Error(`Step for ${step.snippet} into ${step.into} says neither beforeLine, at nor append.`);
    }
    return result.replace(/\n/g, lineEnding);
}

function applyStep(step) {
    if (step.run) {
        // Everything the script writes is remembered first, so the restore takes it away again.
        for (const created of step.creates) rememberOriginal(renderTokens(created));
        run('npm', ['run', step.run], projectDir);
        return `npm run ${step.run}`;
    }
    if (step.edit) {
        const relativePath = renderTokens(step.edit);
        rememberOriginal(relativePath);
        const source = readProjectFile(relativePath);
        const find = renderTokens(step.find);
        if (!source.includes(find)) throw new Error(`${relativePath}: expected to find ${JSON.stringify(find)} to edit.`);
        writeProjectFile(relativePath, source.replace(find, renderTokens(step.replace).replace(/\n/g, source.includes('\r\n') ? '\r\n' : '\n')));
        return `edited ${relativePath}`;
    }
    if (step.file) {
        const relativePath = renderTokens(step.file);
        if (existsSync(path.join(projectDir, relativePath))) throw new Error(`${relativePath} already exists; the scenario only writes new files.`);
        rememberOriginal(relativePath);
        const fileNameBase = path.basename(relativePath, path.extname(relativePath));
        writeProjectFile(relativePath, expandStep(step, fileNameBase));
        return `${step.snippet} -> ${relativePath}`;
    }
    const relativePath = renderTokens(step.into);
    rememberOriginal(relativePath);
    const fileNameBase = path.basename(relativePath, path.extname(relativePath));
    writeProjectFile(relativePath, insertFragment(readProjectFile(relativePath), expandStep(step, fileNameBase), step));
    return `${step.snippet} -> into ${relativePath}`;
}

/** With shell:true (needed for npm's .cmd shim on Windows) arguments with spaces must be quoted by hand. */
function quoteForShell(argument) {
    return isWindows && /\s/.test(argument) ? `"${argument}"` : argument;
}

function run(command, args, cwd) {
    console.log(`\n> ${command} ${args.join(' ')}   (in ${path.relative(projectDir, cwd) || 'project'})`);
    const result = spawnSync(command, args.map(quoteForShell), { cwd, stdio: 'inherit', shell: isWindows });
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (exit ${result.status}).`);
}

/** Rewrites client/src/routeTree.gen.ts from client/src/routes, as the Vite plugin does on dev and build. */
function regenerateRouteTree() {
    const script = [
        "const { Generator, getConfig } = require('@tanstack/router-generator');",
        "const config = getConfig({ target: 'react', autoCodeSplitting: false, routesDirectory: 'src/routes', generatedRouteTree: 'src/routeTree.gen.ts', quoteStyle: 'single', semicolons: true }, process.cwd());",
        'new Generator({ config, root: process.cwd() }).run().catch((error) => { console.error(error); process.exit(1); });',
    ].join(' ');
    const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(projectDir, 'client'), stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Route tree generation failed.');
}

function restore() {
    for (const [relativePath, original] of originals) {
        const absolutePath = path.join(projectDir, relativePath);
        if (original === undefined) rmSync(absolutePath, { force: true });
        else writeFileSync(absolutePath, original);
    }
    if (originals.has('client/src/routes/orders.tsx') && existsSync(routeTreePath)) regenerateRouteTree();
    run('npm', ['run', 'generate'], projectDir);
}

console.log(`Snippets: ${snippetsPath} (${snippetNames.length})`);
console.log(`Project:  ${projectDir} (prefix ${templateTokens.prefix}, folder ${templateTokens.appName})`);
let failed = false;
try {
    rememberOriginal('client/src/routeTree.gen.ts');
    for (const step of scenario) console.log(`  ${applyStep(step)}`);
    run('npm', ['run', 'generate'], projectDir);
    regenerateRouteTree();
    run('npm', ['run', 'typecheck', '--workspaces'], projectDir);
    run('node', ['scripts/checkStructure.mjs'], projectDir);
    console.log(`\nSnippet check passed: ${snippetNames.length} snippets expanded, generated, typechecked and structure-checked.`);
} catch (error) {
    failed = true;
    console.error(`\nSNIPPET CHECK FAILED: ${error.message}`);
    if (!keep) console.error('Re-run with --keep to leave the expanded files in the project for inspection.');
} finally {
    if (keep) console.log('\n--keep: the expanded files are left in the project; run `npm run generate` after removing them.');
    else restore();
}
process.exit(failed ? 1 : 0);
