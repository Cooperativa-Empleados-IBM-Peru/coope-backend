import {expect} from '@loopback/testlab';
import {CloudantController} from '../../controllers/cloudant.controller';
import {CloudantClient} from '../../services/cloudant.service';

interface Call {
  url: string;
  init: RequestInit;
}

function givenClient(status = 200, body: unknown = {ok: true}) {
  const calls: Call[] = [];
  const fetchFn = (async (url: URL | string, init: RequestInit) => {
    calls.push({url: String(url), init});
    return new Response(JSON.stringify(body), {
      status,
      headers: {'content-type': 'application/json'},
    });
  }) as unknown as typeof fetch;
  const client = new CloudantClient(
    {url: 'https://cloudant.example.com/', username: 'u', password: 'p'},
    fetchFn,
  );
  return {calls, controller: new CloudantController(client)};
}

describe('CloudantController', () => {
  it('lists documents with credentials only on the server side', async () => {
    const {calls, controller} = givenClient();
    await controller.allDocs('servicios', true);
    expect(calls).to.have.length(1);
    expect(calls[0].url).to.equal(
      'https://cloudant.example.com/servicios/_all_docs?include_docs=true',
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).to.equal(
      'Basic ' + Buffer.from('u:p').toString('base64'),
    );
  });

  it('rejects databases that are not on the allow list', async () => {
    const {calls, controller} = givenClient();
    await expect(controller.allDocs('_users', false)).to.be.rejectedWith(
      /Not found/,
    );
    await expect(controller.find('_replicator', {})).to.be.rejectedWith(
      /Not found/,
    );
    expect(calls).to.have.length(0);
  });

  it('rejects design/local ids and path traversal', async () => {
    const {calls, controller} = givenClient();
    await expect(
      controller.findById('servicios', '_design/x'),
    ).to.be.rejected();
    await expect(
      controller.findById('servicios', '../_users'),
    ).to.be.rejected();
    await expect(
      controller.replace('servicios', '_local', {}),
    ).to.be.rejected();
    expect(calls).to.have.length(0);
  });

  it('encodes document ids', async () => {
    const {calls, controller} = givenClient();
    await controller.findById('proveedores', 'a b?c');
    expect(calls[0].url).to.equal(
      'https://cloudant.example.com/proveedores/a%20b%3Fc',
    );
  });

  it('requires a valid rev to delete', async () => {
    const {calls, controller} = givenClient();
    await expect(
      controller.remove('servicios', 'doc1', 'x'),
    ).to.be.rejectedWith(/Invalid rev/);
    await controller.remove(
      'servicios',
      'doc1',
      '3-0123456789abcdef0123456789abcdef',
    );
    expect(calls[0].init.method).to.equal('DELETE');
    expect(calls[0].url).to.equal(
      'https://cloudant.example.com/servicios/doc1?rev=3-0123456789abcdef0123456789abcdef',
    );
  });

  it('maps upstream failures without leaking details', async () => {
    const {controller} = givenClient(500, {reason: 'secret db host'});
    await expect(controller.allDocs('servicios', false)).to.be.rejectedWith(
      /Bad gateway/,
    );
  });

  it('is unavailable when not configured', async () => {
    const controller = new CloudantController(new CloudantClient({}));
    await expect(controller.allDocs('servicios', false)).to.be.rejectedWith(
      /Service unavailable/,
    );
  });
});
