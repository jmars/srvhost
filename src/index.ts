import { Hono } from "hono";
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag'
import { z } from 'zod';

const Env = z.object({
  PORT: z.number().default(3000),
  HOST: z.string()
});

type Env = z.infer<typeof Env>;

const app = new Hono<{ Bindings: Env }>();

const DNSQuestion = z.object({
  name: z.string(),
  type: z.number()
})

type DNSQuestion = z.infer<typeof DNSQuestion>;

const DNSAnswer = z.object({
  name: z.string(),
  type: z.number(),
  TTL: z.number(),
  data: z.string()
})

type DNSAnswer = z.infer<typeof DNSAnswer>;

const DNSJSON = z.object({
  Status: z.number(),
  TC: z.boolean(),
  RD: z.boolean(),
  RA: z.boolean(),
  AD: z.boolean(),
  CD: z.boolean(),
  Question: z.array(DNSQuestion),
  Answer: z.array(DNSAnswer)
})

type DNSJSON = z.infer<typeof DNSJSON>;

type RecordType = 'A' | 'SRV';

const lookupRecord = (name: string, type: RecordType): Promise<DNSJSON> => {
  const params = new URLSearchParams({
    name,
    type
  });

  const url = new URL(`/dns-query?${params}`, 'https://1.1.1.1');

  const req = new Request(url.toString(), {
    headers: {
      accept: 'application/dns-json'
    },
    method: 'GET'
  })

  return fetch(req).then(r => r.json()).then(j => DNSJSON.parseAsync(j));
}

const SRVRecord = z.object({
  priority: z.string(),
  weight: z.string(),
  port: z.string(),
  host: z.string(),
  ip: z.string().optional()
})

type SRVRecord = z.infer<typeof SRVRecord>;

const lookupSrv = async (name: string): Promise<SRVRecord> => {
  const res = await lookupRecord(name, 'SRV');

  const answer = res.Answer?.[0];
  if (answer !== undefined) {
    const [ priority, weight, port, host ] = answer.data.split(' ');
    return SRVRecord.parseAsync({ priority, weight, port, host });
  } else {
    throw new Error("Record not found");
  }
};

app.use('*', logger());
if (typeof process !== "undefined") {
  app.use('*', compress());
}
app.use('*', etag());

let PORT: number, HOST: string;

if (typeof process !== "undefined") {
  const env = Env.parse({
    PORT: process.env.PORT,
    HOST: process.env.HOST
  });
  PORT = env.PORT;
  HOST = env.HOST;
}

app.use("*", async (c) => {
  const url = new URL(c.req.url);
  const srvhost = HOST ?? c.env.HOST;
  const https = url.protocol.startsWith('https');
  try {
    const { port, host } = await lookupSrv(`_${https ? 'https' : 'http'}._tcp.${srvhost}`);
    url.port = port;
    url.host = host;
    const req = new Request(url.toString(), c.req);
    return fetch(req);
  } catch (e) {
    return c.text('Service not found', 404);
  }
});

export default {
  port: PORT,
  fetch: app.fetch
};
