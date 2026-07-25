---
name: vllnt-convex-permissions
description: Add typed, runtime-editable RBAC to Convex apps with sandboxed role and grant tables, wildcard rules, multi-tenant scoping, and default-deny enforcement. Use this skill whenever the user mentions auth, rbac, access-control. Also trigger when discussing permissions, authorization, add role-based access control to convex functions, even if they don't explicitly ask for Permissions (RBAC).
version: 0.1.0-canary.1236fb6
---

> Agents: read this skill fully before writing code that uses Permissions (RBAC). Follow the installation and configuration steps exactly.

# Permissions (RBAC)

## Instructions

Use Permissions (RBAC) to add typed, runtime-editable rbac to convex apps with sandboxed role and grant tables, wildcard rules, multi-tenant scoping, and default-deny enforcement. This Convex component integrates directly with your backend.

### Installation

```bash
bun install @vllnt/convex-permissions
```

Current npm version: `@vllnt/convex-permissions@0.1.0-canary.1236fb6`

### Capabilities

- Define and modify roles at runtime without redeploying — roles, grants, and assignments are stored in sandboxed Convex tables and updated via mutations.
- Enforce access with a single require() call that throws a typed ConvexError on denial, eliminating manual permission checks scattered across functions.
- Model multi-tenant authorization by scoping role assignments to an opaque scopeRef, so the same subject can hold different roles across organizations or workspaces.
- Keep the component auth-library-agnostic by using opaque string refs for subjects, scopes, and actions, letting you integrate with any identity provider or domain model.

## Examples

### how to add role-based access control to Convex functions

The @vllnt/convex-permissions component adds RBAC directly to Convex as a first-class component. You define roles with named action grants using permissions.defineRole(), assign them to subjects with permissions.assign(), and enforce them inside any query or mutation with permissions.require(), which throws a ConvexError if the subject lacks the required action. Roles and assignments live in sandboxed tables and can be changed at runtime without redeploying.

### multi-tenant permissions Convex per organization

The @vllnt/convex-permissions component supports multi-tenant authorization through an optional scopeRef on every assign(), revoke(), check(), and require() call. You pass an opaque organization or workspace identifier as the scopeRef, and role assignments are isolated to that scope. A subject can hold the editor role in one organization and only the viewer role in another, with unscoped assignments applying globally as a fallback.

### wildcard permission grants Convex RBAC

The @vllnt/convex-permissions component supports wildcard grant strings when defining roles. Passing doc.* as a grant covers every action whose key starts with doc., and * grants all actions. This lets you define coarse admin roles alongside fine-grained viewer or editor roles without enumerating every action string.

### how to enforce access control in Convex queries and mutations

Inside any Convex query or mutation, call permissions.require(ctx, { subjectRef, action, scopeRef? }) from the @vllnt/convex-permissions component. If the subject does not hold a role that grants the specified action, it throws a ConvexError with a PermissionDenied payload that the host function maps to a 403. For non-throwing checks, permissions.check() returns a boolean instead.

## When NOT to use

- When a simpler built-in solution exists for your specific use case
- If you are not using Convex as your backend
- When the functionality provided by Permissions (RBAC) is not needed

## Troubleshooting

**Does @vllnt/convex-permissions work with any auth provider?**

Yes. The @vllnt/convex-permissions component is intentionally agnostic. It identifies subjects, scopes, and actions using opaque strings you supply, with no coupling to Clerk, Auth0, or any other auth library. Your host function authenticates the caller however it chooses, resolves their identity to a subjectRef string, and passes that string to the component.

**What happens when a subject has no assigned role or the action is not covered by any grant?**

The @vllnt/convex-permissions component is default-deny. If a subject has no matching role assignment, or if none of their assigned roles include a grant covering the requested action, permissions.check() returns false and permissions.require() throws a ConvexError<PermissionDenied>. Unknown subjects are denied without error, so there is no way to accidentally permit an unrecognized caller.

**Can roles and grants be changed without redeploying the Convex backend?**

Yes. In @vllnt/convex-permissions, role definitions, action grants, and subject assignments are all stored in sandboxed Convex tables. You update them by calling the component's mutation methods (defineRole, removeRole, assign, revoke) from your own host mutations at runtime. No schema change or redeploy is needed.

**How do I install and register the @vllnt/convex-permissions component?**

Run bun install @vllnt/convex-permissions to add the package. Then register it in your convex/convex.config.ts file by importing the component config and calling app.use(permissions). After that, instantiate a typed client in a convex/permissions.ts file using new Permissions<Role, Action>(components.permissions) with your own Role and Action union types.

**Is @vllnt/convex-permissions compatible with self-hosted Convex backends?**

Yes. According to the README, @vllnt/convex-permissions runs identically on Convex Cloud and self-hosted convex-backend deployments. The peer dependency is convex@^1.36.1.

## Resources

- [npm package](https://www.npmjs.com/package/%40vllnt%2Fconvex-permissions)
- [GitHub repository](https://github.com/vllnt/convex-permissions)
- [Live demo](https://vllnt.com/)
- [Convex Components Directory](https://www.convex.dev/components/vllnt/convex-permissions)
- [Convex documentation](https://docs.convex.dev)
