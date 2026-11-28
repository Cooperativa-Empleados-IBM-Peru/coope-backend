import {expect} from '@loopback/testlab';
import {Client} from '@loopback/testlab';
import {CoopeibmDataapiApplication} from '../..';
import {setupApplication} from './test-helper';

describe('Filter sanitizer (acceptance)', () => {
  let app: CoopeibmDataapiApplication;
  let client: Client;

  before('setupApplication', async () => {
    ({app, client} = await setupApplication());
  });

  after(async () => {
    await app.stop();
  });

  it('rejects a malicious order with 400 before reaching the database', async () => {
    const filter = JSON.stringify({where: {codempleado: '1'}, order: ['cuota ASC; DROP TABLE x']});
    const res = await client.get('/vwsociosibm').query({filter}).expect(400);
    expect(JSON.stringify(res.body)).to.match(/Invalid filter: order/);
  });

  it('rejects a malicious order on another controller', async () => {
    const filter = JSON.stringify({order: ['x ASC, (SELECT 1 FROM SYSIBM.SYSDUMMY1)']});
    await client.get('/movahorros').query({filter}).expect(400);
  });
});
