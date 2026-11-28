import {expect} from '@loopback/testlab';
import {UsersController} from '../../controllers/users.controller';

interface Executed {
  sql: string;
  params: unknown[];
}

function givenController(options: {
  socios?: Array<{uuid: string}>;
  admins?: unknown[];
  failInsert?: boolean;
}) {
  const executed: Executed[] = [];
  const filters: unknown[] = [];
  const sociosRepo = {
    find: async (filter: unknown) => {
      filters.push(filter);
      return options.socios ?? [];
    },
  };
  const adminsRepo = {
    find: async (filter: unknown) => {
      filters.push(filter);
      return options.admins ?? [];
    },
  };
  const dataSource = {
    execute: async (sql: string, params: unknown[]) => {
      executed.push({sql, params});
      if (options.failInsert) throw new Error('db down');
    },
  };

  const controller = new UsersController(
    sociosRepo as unknown as ConstructorParameters<typeof UsersController>[0],
    adminsRepo as unknown as ConstructorParameters<typeof UsersController>[1],
    dataSource as unknown as ConstructorParameters<typeof UsersController>[2],
  );
  return {controller, executed, filters};
}

describe('UsersController', () => {
  it('returns uuid and isAdmin=true when the user is in VWCOOPEADMINS', async () => {
    const {controller} = givenController({
      socios: [{uuid: 'abc   '}],
      admins: [{codempleado: '1'}],
    });
    expect(await controller.login({email: 'a@b.com'})).to.eql({
      uuid: 'abc',
      isAdmin: true,
    });
  });

  it('returns isAdmin=false when the user is not in VWCOOPEADMINS', async () => {
    const {controller} = givenController({socios: [{uuid: 'abc'}], admins: []});
    expect(await controller.login({email: 'a@b.com'})).to.eql({
      uuid: 'abc',
      isAdmin: false,
    });
  });

  it('returns an empty uuid when the email matches 0 or several members', async () => {
    expect(
      (await givenController({socios: []}).controller.login({email: 'a@b.com'}))
        .uuid,
    ).to.equal('');
    const two = givenController({socios: [{uuid: '1'}, {uuid: '2'}]});
    expect((await two.controller.login({email: 'a@b.com'})).uuid).to.equal('');
  });

  it('binds the email as a SQL parameter (no string concatenation)', async () => {
    const evil = "x'); DROP TABLE USERSLOGIN; --";
    const {controller, executed, filters} = givenController({});
    await controller.login({email: evil});
    expect(executed).to.have.length(1);
    expect(executed[0].sql).not.to.containEql('DROP');
    expect(executed[0].sql).to.containEql('VALUES (?, CURRENT TIMESTAMP)');
    expect(executed[0].params).to.eql([evil]);
    expect(JSON.stringify(filters[0])).to.containEql('emailempleado2');
  });

  it('does not fail the login when the audit insert fails', async () => {
    const {controller} = givenController({
      socios: [{uuid: 'abc'}],
      failInsert: true,
    });
    expect((await controller.login({email: 'a@b.com'})).uuid).to.equal('abc');
  });

  it('is-admin answers from VWCOOPEADMINS only', async () => {
    expect(
      await givenController({admins: [{}]}).controller.isAdmin({
        email: 'a@b.com',
      }),
    ).to.eql({isAdmin: true});
    expect(
      await givenController({admins: []}).controller.isAdmin({
        email: 'a@b.com',
      }),
    ).to.eql({isAdmin: false});
  });

  it('rejects an empty email', async () => {
    await expect(
      givenController({}).controller.isAdmin({email: '  '}),
    ).to.be.rejectedWith(/email is required/);
  });
});
