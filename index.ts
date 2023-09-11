// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { nodes, root, state } from "membrane";
import { api } from "./utils";
import MD5 from "spark-md5";

state.subscriptions = state.subscriptions ?? new Map();

export const Root = {
  audiences: () => ({}),
  status: () => {
    if (!state.token) {
      return "Please get [API Key](https://mailchimp.com/help/about-api-keys/) and [configure](:configure) it.";
    } else {
      return "Ready";
    }
  },
  tests: () => ({}),
  parse: ({ name, value }) => {
    switch (name) {
      case "audience": {
        return [root.audiences.one({ id: value })];
      }
    }
  },
};

export const Tests = {
  testGetAudiences: async () => {
    const items = await root.audiences.page.items.$query(`{ id }`);
    return Array.isArray(items);
  },
};

export const AudienceCollection = {
  one: async ({ id }) => {
    const req = await api("GET", `lists/${id}`);
    return await req.json();
  },
  page: async (args, { self }) => {
    const req = await api("GET", "lists", { ...args });
    const result = await req.json();

    const nextOffset = (args.offset ?? 0) + result.lists.length;
    const next =
      nextOffset >= result.total_items
        ? null
        : self.page({ count: args.count, offset: nextOffset });

    return {
      items: result.lists,
      next,
    };
  },
};

export const Audience = {
  gref: (_, { obj }) => {
    return root.audiences.one({ id: obj.id });
  },
  members: () => ({}),

  subscribed: {
    subscribe: async ({ email }, { self }) => {
      const { id: listId } = self.$argsAt(root.audiences.one);
      // Create a webhook
      const body = {
        url: await nodes.process.endpointUrl,
        events: {
          subscribe: true,
          unsubscribe: true,
          profile: false,
          cleaned: false,
          upemail: false,
          campaign: false,
        },
        sources: {
          user: true,
          admin: true,
          api: true,
        },
      };
      const res = await api("POST", `lists/${listId}/webhooks`, null, body);
      if (res.status !== 200) {
        throw new Error(
          `Failed to create webhook: ${res.status}: ${await res.text()}`
        );
      }
      const { id } = await res.json();
      state.subscriptions.set(self, id);
    },
    unsubscribe: async ({ email }, { self }) => {
      const { id: listId } = self.$argsAt(root.audiences.one);
      // Delete the webhook
      const webhookId = state.subscriptions.get(self);
      const res = await api("DELETE", `lists/${listId}/webhooks/${webhookId}`);
      if (res.status !== 204) {
        throw new Error(
          `Failed to delete webhook ${webhookId}: ${
            res.status
          }: ${await res.text()}`
        );
      }
    },
  },
};

export const Member = {
  gref: (_, { self, obj }) => {
    const { id: audienceId } = self.$argsAt(root.audiences.one);

    return root.audiences.one({ id: audienceId }).members.one({ hash: obj.id });
  },
};

export const MemberCollection = {
  one: async ({ hash }, { self }) => {
    const { id } = self.$argsAt(root.audiences.one);

    const req = await api("GET", `lists/${id}/members/${hash}`);
    return await req.json();
  },
  page: async (args, { self }) => {
    const { id } = self.$argsAt(root.audiences.one);

    const req = await api("GET", `lists/${id}/members`, { ...args });
    const result = await req.json();

    const nextOffset = (args.offset ?? 0) + result.members.length;
    const next =
      nextOffset >= result.total_items
        ? null
        : self.page({ count: args.count, offset: nextOffset });

    return {
      items: result.members,
      next,
    };
  },
};

export async function configure({ API_KEY }) {
  const [, dc] = API_KEY.split("-");
  state.server = dc;
  state.token = API_KEY;
  root.statusChanged.$emit();
}

export async function endpoint({ method, path, body }) {
  if (method === "POST") {
    switch (path) {
      case "/": {
        const event = new URLSearchParams(body);
        const email = event.get("data[email]")!;
        const listId = event.get("data[list_id]");
        const memberId = MD5.hash(email);
        const audience = root.audiences.one({ id: listId! });
        const member = audience.members.one({ hash: memberId! });
        const type = event.get("type");
        if (type === "unsubscribe") {
          audience.unsubscribed.$emit({ email, member, audience });
        } else if (type === "subscribe") {
          audience.subscribed.$emit({ email, member, audience });
        } else {
          console.log("Ignoring event of type", type);
        }
      }
    }
  }
  return JSON.stringify({ status: 200 });
}
