/**
 * VS Code snippet expansion, shared by the checks that write snippets into a scaffold (checkSnippets.mjs,
 * checkHowToUse.mjs). expandSnippet renders a snippet body the way VS Code would once the developer has typed
 * the given tab stop values: the file name in, every other tab stop at its default.
 */

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
export function expandSnippet(body, { fileNameBase, values = {} }) {
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
