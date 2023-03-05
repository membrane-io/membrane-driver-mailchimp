// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { nodes, root, state } from "membrane";
import { toJSON } from "./util";

async function api(method: string, path: string, query?: any, body?: string) {
  if (!state.token || !state.server) {
    throw new Error("You must first invoke the configure action with an API key");
  }
  if (query) {
    Object.keys(query).forEach((key) => (query[key] === undefined ? delete query[key] : {}));
  }
  const querystr = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
  const url = `https://${state.server}.api.mailchimp.com/3.0/${path}${querystr}`;
  const req = {
    method,
    body,
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${state.token}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  };
  return await fetch(url, req);
}

export const Root = {
  audiences: () => ({}),
};

export const AudienceCollection = {
  one: async ({ args: { id } }) => {
    const req = await api("GET", `lists/${id}`);
    return await req.json();
  },
  page: async ({ self, args }) => {
    const req = await api("GET", "lists", { ...args });
    const result = await req.json();

    return {
      items: result.lists,
      next: self.page({ count: args.count, offset: result.total_items }),
    };
  },
};

export const Audience = {
  gref: ({ obj }) => {
    return root.audiences.one({ id: obj.id });
  },
  members: () => ({}),
};

export const Member = {
  gref: ({ self, obj }) => {
    const { id: audienceId } = self.$argsAt(root.audiences.one);

    return root.audiences.one({ id: audienceId }).members.one({ hash: obj.id });
  },
};

export const MemberCollection = {
  one: async ({ self, args: { hash } }) => {
    const { id } = self.$argsAt(root.audiences.one);

    const req = await api("GET", `lists/${id}/members/${hash}`);
    return await req.json();
  },
  page: async ({ self, args }) => {
    const { id } = self.$argsAt(root.audiences.one);

    const req = await api("GET", `lists/${id}/members`, { ...args });
    const result = await req.json();

    return {
      items: result.members,
      next: self.page({ count: args.count, offset: result.total_items }),
    };
  },
};

export async function configure({ args: { API_KEY } }) {
  const [, dc] = API_KEY.split("-");
  state.server = dc;
  state.token = API_KEY;
}

export async function endpoint({ args: { path, query, headers, body } }) {
  switch (path) {
    case "/webhook": {
      const event = toJSON(body);
      const { type, data } = event;
      await dispatchEvent(data.id, data.list_id, type);

      return JSON.stringify({
        status: 200,
      });
    }
  }
}

async function dispatchEvent(userId, AudienceId, type) {
  const member: any = root.audiences.one({ id: AudienceId }).members.one({ hash: userId });
  return root.audiences.one({ id: AudienceId }).subscriptions.$emit({ member, type });
}
