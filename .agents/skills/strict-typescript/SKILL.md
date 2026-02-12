---
name: strict-typescript
description: Rust-inspired TypeScript patterns. Must use when reading or writing TypeScript/JavaScript files.
---

# Strict TypeScript

Rust-inspired TypeScript. The type system is a proof system -- if it compiles, it's correct. No escape hatches.

## Philosophy: Only Enforce What You Can Know

TypeScript's type system is structural and cooperative. It cannot enforce constraints across code you don't control (third-party libraries, runtime behavior). Strictness is only valuable when the compiler can guarantee it end-to-end.

**Enforce aggressively** things the compiler can actually check:

- Discriminated unions and exhaustive matching (the compiler proves every case is handled)
- Branded/newtype patterns (the compiler prevents mixing up same-shaped values)
- `noUncheckedIndexedAccess` (the compiler forces you to handle `undefined`)
- `unknown` + zod parsing at boundaries (the compiler forces you to parse before use)

**Don't enforce** things the compiler cannot guarantee across boundaries:

- `readonly` / `ReadonlyArray<T>` on types that will be passed to libraries expecting mutable types. The annotation claims immutability but the compiler can't enforce it once the value leaves your code. This creates false confidence and forces `as` casts to interoperate -- the exact escape hatch we're trying to avoid.
- `exactOptionalPropertyTypes` in tsconfig. It distinguishes "missing" from "present but `undefined`", but `JSON.parse`, most libraries, and spread syntax don't respect this distinction. Same boundary problem as `readonly` -- it forces workarounds at every integration point.
- Overly narrow types that require widening casts at integration points.

The litmus test: if a strictness annotation forces you to use `as` or `as unknown as` somewhere else, the annotation is making the type system lie. Remove the annotation, not the safety.

When in doubt, be defensive with zod parsing at boundaries rather than adding type-level constraints that can't survive contact with external code.

## Hard Rules

These are non-negotiable. Every one is enforced by tooling (biome, tsconfig, or both).

1. **No type assertions.** Never use `as`, `!` (non-null assertion), or `<Type>` angle-bracket casts. The biome plugin `biome-plugin-no-type-assertion` enforces this. If you think you need `as`, you have a design problem. Use `satisfies` when you want to verify a value conforms to a type without widening or narrowing it.
2. **No `any`.** Never use `any`. Use `unknown` and parse it with zod.
3. **No `@ts-ignore` or `@ts-expect-error`.** Fix the type error. Don't suppress it.
4. **`type` over `interface`.** Always use `type`. Never use `interface`. `type` is closed (cannot be extended by declaration merging), composes with `&` and `|`, and behaves more like Rust's `struct` and `enum`. `interface` is open, which we don't want.
5. **Named types always.** Never use inline anonymous object types. Extract every object shape into a named `type`.
6. **Parse, don't validate.** External data enters the system as `unknown` and must be parsed through a zod schema before use. No manual type guards as the primary narrowing strategy.
7. **No hungarian notation.** Name things for what they mean, not what they are. The type system already encodes "what it is". `userString`, `emailStr`, `itemsArray`, `configMap`, `IUser`, `TResult` are all wrong. `user`, `email`, `items`, `config` are right.
8. **Shadowing is good.** When you parse or refine a value, shadow the original name so the unrefined binding is no longer accessible. Don't invent new names like `rawUser`/`parsedUser` -- that's hungarian notation for lifecycle stage and leaves the dangerous binding in scope.
9. **Newtype over naming.** Encode semantic meaning in the type, not the variable name. Prefer `function validate(id: Uuid)` over `function validate(uuid: string)`. The compiler can check types; it can't check that you passed the right string. Use zod-branded types liberally for domain primitives: `Uuid`, `EmailAddress`, `SlackChannelId`, `Url`.
10. **Rust-style type casing.** PascalCase for types, treating acronyms as single words. `Uuid` not `UUID`, `HttpClient` not `HTTPClient`, `ApiKey` not `APIKey`, `JsonParser` not `JSONParser`. Matches Rust's `clippy::upper_case_acronyms`. All-caps acronyms are unreadable when compounded (`HTTPSURLConnection` vs `HttpsUrlConnection`).

## Type-First Development

Types define the contract before implementation:

1. **Define the data model** -- zod schemas and `type` declarations first
2. **Define function signatures** -- input/output types before logic
3. **Implement to satisfy types** -- let the compiler guide completeness
4. **Parse at boundaries** -- zod schemas where data enters the system

## Making Illegal States Unrepresentable

### Discriminated unions for mutually exclusive states

The TypeScript equivalent of Rust's `enum`:

```ts
// Good: only valid combinations possible
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

// Bad: allows invalid combinations like { loading: true, error: Error }
type RequestState<T> = {
  loading: boolean;
  data?: T;
  error?: Error;
};
```

### Exhaustive matching with `never`

The TypeScript equivalent of Rust's exhaustive `match`:

```ts
type Status = "active" | "inactive" | "pending";

function processStatus(status: Status): string {
  switch (status) {
    case "active":
      return "processing";
    case "inactive":
      return "skipped";
    case "pending":
      return "waiting";
    default: {
      const _exhaustive: never = status;
      throw new Error(`unhandled status: ${_exhaustive}`);
    }
  }
}
```

Adding a new variant to `Status` causes a compile error at every switch that doesn't handle it. This is the whole point.

### Branded types without `as`

Use zod to construct branded types. This avoids `as` casts entirely:

```ts
import { z } from "zod";

const UserId = z.string().uuid().brand<"UserId">();
type UserId = z.infer<typeof UserId>;

const OrderId = z.string().uuid().brand<"OrderId">();
type OrderId = z.infer<typeof OrderId>;

// Compiler prevents passing OrderId where UserId expected.
// Construction goes through the schema -- no `as` needed.
function getUser(id: UserId): Promise<User> {
  /* ... */
}

const userId = UserId.parse("550e8400-e29b-41d4-a716-446655440000"); // UserId
const orderId = OrderId.parse("550e8400-e29b-41d4-a716-446655440001"); // OrderId

getUser(orderId); // Compile error
```

### `satisfies` over `as` for conformance checks

When you want to verify a value conforms to a type without widening or narrowing it, use `satisfies`. It validates the type at compile time while preserving the narrower inferred type:

```ts
// Bad: `as` widens -- you lose the literal types
const config = {
  port: 3000,
  host: "localhost",
} as Config;
// config.port is `number`, not `3000`

// Good: `satisfies` checks conformance without widening
const config = {
  port: 3000,
  host: "localhost",
} satisfies Config;
// config.port is `3000`, config.host is `"localhost"`

// Good: validate a record has the right shape while keeping literal keys
const routes = {
  home: "/",
  about: "/about",
  contact: "/contact",
} satisfies Record<string, string>;
// typeof routes still knows about `home`, `about`, `contact` keys
```

### Required vs optional -- be explicit

```ts
type CreateUser = {
  email: string;
  name: string;
};

type UpdateUser = Partial<CreateUser>;

type User = CreateUser & {
  id: UserId;
  createdAt: Date;
};
```

## Zod as Serde

Zod is our `serde::Deserialize`. It is the single source of truth for data shapes.

### Schema-first, infer the type

```ts
import { z } from "zod";

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().transform((s) => new Date(s)),
});

type User = z.infer<typeof UserSchema>;
```

### `parse` vs `safeParse`

- **`parse`** at trust boundaries where invalid data is a bug (API client responses, config). Throws on failure. Like Rust's `.unwrap()` -- use it when failure means a contract violation.
- **`safeParse`** for user input where failure is expected (form data, CLI args). Returns a discriminated union. Like Rust's `Result<T, E>`.

```ts
// Trust boundary: API response must conform to contract
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`fetch user ${id} failed: ${response.status}`);
  }
  const data: unknown = await response.json();
  return UserSchema.parse(data);
}

// User input: failure is expected, return Result-like
export function parseUserInput(
  raw: unknown,
): z.SafeParseReturnType<unknown, User> {
  return UserSchema.safeParse(raw);
}

const result = parseUserInput(formData);
if (!result.success) {
  handleErrors(result.error.flatten().fieldErrors);
  return;
}
await submitUser(result.data);
```

### Schema composition

```ts
const CreateUserSchema = UserSchema.omit({ id: true, createdAt: true });
const UpdateUserSchema = CreateUserSchema.partial();
const UserWithPostsSchema = UserSchema.extend({
  posts: z.array(PostSchema),
});
```

### Config parsing

Parse environment at startup. Crash on invalid config. Access the typed object everywhere else.

```ts
import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const config = ConfigSchema.parse(process.env);
```

## Immutability by Default

Prefer `const` over `let`. Use `let` only when reassignment is required. Use `as const` for literal values that should not widen. Never mutate function parameters -- return new objects/arrays instead.

```ts
const ROLES = ["admin", "user", "guest"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "user" | "guest"

function withTimeout(config: Config, timeout: number): Config {
  return { ...config, timeout };
}
```

## Don't Use `readonly` on Types

**Do not use `readonly`, `Readonly<T>`, or `ReadonlyArray<T>` on type fields, function parameters, or return types.** These annotations are cooperative -- they only constrain code that opts in. Third-party libraries overwhelmingly use mutable types (`T[]`, not `ReadonlyArray<T>`). Marking your own types readonly then passing them to library functions forces one of:

1. `as` casts to strip readonly (violates rule #1)
2. Deep-cloning at every boundary (performance hit for zero real safety)
3. Giving up and using mutable types anyway

Option 3 is the honest one. Rust's borrow checker works because it is enforced across _all_ code, including dependencies. TypeScript's `readonly` is not. It makes the type system lie: the annotation claims immutability but cannot enforce it once the value crosses a boundary you don't control.

Use `const` for bindings, `as const` for literals, and discipline (don't mutate parameters) for the rest. Don't annotate types with `readonly` -- it creates false confidence and forces escape hatches.

## Functional Patterns

- Use `array.map/filter/reduce` over `for` loops.
- Write pure functions for business logic; isolate side effects in dedicated modules.
- Chain transformations in pipelines.

## Error Handling

- Every code path returns a value or throws. No silent failures.
- Wrap external calls with contextual error messages.
- Propagate errors with context; catching requires re-throwing or returning a meaningful result.

```ts
export async function fetchWidget(id: string): Promise<Widget> {
  const response = await fetch(`/api/widgets/${id}`);
  if (!response.ok) {
    throw new Error(`fetch widget ${id} failed: ${response.status}`);
  }
  const data: unknown = await response.json();
  return WidgetSchema.parse(data);
}
```

## Utility Types Reference

Prefer these builtins over hand-rolling equivalent types:

| Utility          | Purpose                           |
| ---------------- | --------------------------------- |
| `Pick<T, K>`     | Select fields from T              |
| `Omit<T, K>`     | Exclude fields from T             |
| `Partial<T>`     | All fields optional               |
| `Required<T>`    | All fields required               |
| `Record<K, V>`   | Object with known key/value types |
| `Extract<U, T>`  | Extract members from union        |
| `Exclude<U, T>`  | Remove members from union         |
| `NonNullable<T>` | Remove null and undefined         |
| `ReturnType<F>`  | Function return type              |
| `Parameters<F>`  | Function parameter types as tuple |

## tsconfig Strictness

These flags must be enabled. They are not optional.

```jsonc
{
  "compilerOptions": {
    // Core strict umbrella (noImplicitAny, strictNullChecks, strictFunctionTypes,
    // strictBindCallApply, strictPropertyInitialization, noImplicitThis, alwaysStrict)
    "strict": true,

    // Index signatures return T | undefined, not T. Forces handling the None case.
    "noUncheckedIndexedAccess": true,

    // Require `override` keyword for overridden methods.
    "noImplicitOverride": true,

    // Prevent fallthrough in switch (pairs with exhaustive matching).
    "noFallthroughCasesInSwitch": true,

    // Catch dead code.
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Force `import type` for type-only imports.
    "verbatimModuleSyntax": true,

    // Force bracket notation for index signature access.
    "noPropertyAccessFromIndexSignature": true,
  },
}
```

## Module Structure

- Small, focused files. One concern per file. Split at ~200 lines.
- Colocate tests: `foo.test.ts` alongside `foo.ts`.
- Group by feature, not by layer.
- Use `import type` for type-only imports.

## Naming

### Variables: what it means, not what it is

```ts
// Bad: type information in the name
const userString = "alice@example.com";
const itemsArray = [1, 2, 3];
const configMap = new Map();
const rawResponse = await fetch(url);
const parsedUser = UserSchema.parse(data);

// Good: the type system tells you what it is
const email = "alice@example.com";
const items = [1, 2, 3];
const config = new Map();
const response = await fetch(url);
const user = UserSchema.parse(data);
```

### Shadow, don't rename

When refining a value, shadow it. The old binding disappears and can't be used by mistake:

```ts
// Bad: rawUser is still in scope, someone will use it
const rawUser = await response.json();
const parsedUser = UserSchema.parse(rawUser);

// Good: shadow so the unrefined value is inaccessible
function parseUser(data: unknown): User {
  const user = UserSchema.parse(data);
  return user;
}

// Good: in sequential scopes, reuse the name
const data: unknown = await response.json();
const user = UserSchema.parse(data);
// `data` is still in scope but the intent is clear --
// `user` is the refined value you work with from here.
```

### Types: newtype pattern for domain meaning

```ts
// Bad: compiler can't distinguish these strings
function sendEmail(to: string, from: string, subject: string): void {
  /* ... */
}
sendEmail(subject, from, to); // Compiles fine. Bug.

// Good: branded types make the compiler catch misuse
const EmailAddress = z.string().email().brand<"EmailAddress">();
type EmailAddress = z.infer<typeof EmailAddress>;

const Subject = z.string().min(1).brand<"Subject">();
type Subject = z.infer<typeof Subject>;

function sendEmail(
  to: EmailAddress,
  from: EmailAddress,
  subject: Subject,
): void {
  /* ... */
}
sendEmail(subject, from, to); // Compile error.
```

### Type casing: acronyms are words

```ts
// Bad
type UUID = string & { readonly __brand: "UUID" };
type HTTPClient = {
  /* ... */
};
type APIKey = string & { readonly __brand: "APIKey" };
type JSONParser = {
  /* ... */
};

// Good
type Uuid = z.infer<typeof Uuid>;
type HttpClient = {
  /* ... */
};
type ApiKey = z.infer<typeof ApiKey>;
type JsonParser = {
  /* ... */
};
```

## What Not To Do

| Pattern                                                 | Why it's banned                              | Do this instead                                      |
| ------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `value as Type`                                         | Lies to the compiler                         | Parse with zod, narrow with control flow, or use `satisfies` |
| `value!`                                                | Asserts non-null without proof               | Check for null, restructure to eliminate nullability |
| `any`                                                   | Turns off the type system                    | Use `unknown` + zod parse                            |
| `interface Foo`                                         | Open to declaration merging                  | `type Foo = { ... }`                                 |
| `{ name: string; age: number }` inline                  | Anonymous, not reusable                      | Extract to `type Person = { ... }`                   |
| `@ts-ignore` / `@ts-expect-error`                       | Hides real type errors                       | Fix the type error                                   |
| Manual type guards as primary strategy                  | Hand-written, can drift from type            | Zod schemas as source of truth                       |
| `eslint-disable` / `biome-ignore` without justification | Suppresses safety checks                     | Fix the underlying issue                             |
| `const userString = ...`                                | Hungarian notation; type info in name        | `const user = ...`                                   |
| `const rawX = ...; const parsedX = ...`                 | Hungarian for lifecycle; leaves raw in scope | Shadow: parse into the same name                     |
| `fn(uuid: string)`                                      | Meaning in name, not type                    | `fn(id: Uuid)` -- newtype pattern                    |
| `UUID`, `HTTPClient`, `APIKey`                          | All-caps acronyms are unreadable             | `Uuid`, `HttpClient`, `ApiKey`                       |
| `readonly` fields, `Readonly<T>`, `ReadonlyArray<T>`    | Cooperative, not enforced across boundaries  | Use `const` bindings, `as const` literals, discipline |
| `exactOptionalPropertyTypes`                            | Libraries and JSON don't respect the distinction | Omit from tsconfig; validate with zod at boundaries  |
