// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { nodes, root, state } from "membrane";
import { api } from "./utils";
import MD5 from "spark-md5";

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
};

export const Tests = {
  testGetAudiences: async () => {
    const items = await root.audiences.page.items.$query(`{ id }`);
    return Array.isArray(items);
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

export async function configure({ args: { API_KEY } }) {
  const [, dc] = API_KEY.split("-");
  state.server = dc;
  state.token = API_KEY;
}

export async function endpoint({ args: { path, query, headers, body } }) {
  switch (path) {
    case "/": {
      // Prepare the data
      const parsedData: any = new URLSearchParams(body);
      const data = {};
      for (const [key, value] of parsedData.entries()) {
        data[key] = decodeURIComponent(value);
      }
      // subscription event data
      const id = data["data[list_id]"];
      const email = data["data[email]"];
      const type = data["type"];

      // member hash is md5 of email
      const hashId = MD5.hash(email);

      // get the member gref
      const member: any = root.audiences
        .one({ id })
        .members.one({ hash: hashId });

      // dispatch event
      await root.audiences.one({ id }).memberSubscribed.$emit({ member, type });
      console.log(`Received ${type} event for ${email} in list ${id}`);
      return JSON.stringify({ status: 200 });
    }
  }
}
