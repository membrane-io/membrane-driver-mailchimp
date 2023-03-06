// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { nodes, root, state } from "membrane";
import { toJSON, api } from "./utils";
import MD5 from "spark-md5";

export const Root = {
  audiences: () => ({}),
  status: () => {
    if (!state.token) {
      return "Please get [API Key](https://mailchimp.com/help/about-api-keys/) and configure.";
    } else {
      return "Ready";
    }
  },
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
    case "/": {
      const event = toJSON(body);
      // get member info
      const { type, data } = event;
      // member hash is md5 of email
      const hashId = MD5.hash(data.email);
      // dispatch event
      const member: any = root.audiences.one({ id: data.list_id }).members.one({ hash: hashId });
      await root.audiences.one({ id: data.list_id }).subscriptions.$emit({ member, type });

      return JSON.stringify({ status: 200 });
    }
  }
}
