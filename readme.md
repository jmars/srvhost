# SRVHost

Srvhost is a small http gateway which will route http requests, with correct ports, based on DNS Srv records.

It can be deployed as a cloudflare worker or as a self-hosted Bun application.

## Environment
The following environment variables are used for configuration:
* PORT: the port to run on (not used on cloudflare). Should be 80 or 443.
* HOST: the DNS host where service records are located

## Example

Running srvhost with the config PORT=443 and HOST=datacenter1.example.com and pointing example.com to it will result in the following request flow:
![Flow](docs/flow.svg?raw=true "Flow")