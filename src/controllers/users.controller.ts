import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors, post, requestBody, RequestBodyObject} from '@loopback/rest';
import {Db2CoopeDataSource} from '../datasources';
import {db2config} from '../datasources/env';
import {VwcoopeadminsRepository, VwsociosactivosRepository} from '../repositories';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const EMAIL_BODY: Partial<RequestBodyObject> = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['email'],
        additionalProperties: false,
        properties: {email: {type: 'string', minLength: 3, maxLength: 100}},
      },
    },
  },
};

export interface LoginInfo {
  uuid: string;
  isAdmin: boolean;
}

export class UsersController {
  constructor(
    @repository(VwsociosactivosRepository)
    private sociosActivosRepository: VwsociosactivosRepository,
    @repository(VwcoopeadminsRepository)
    private adminsRepository: VwcoopeadminsRepository,
    @inject('datasources.db2coope')
    private dataSource: Db2CoopeDataSource,
  ) {}

  /**
   * Registers a login in USERSLOGIN and returns the member uuid (only when
   * exactly one active member owns the email) and whether the user is an
   * Admin, i.e. it is listed in the VWCOOPEADMINS view.
   */
  @post('/users/login', {
    responses: {
      '200': {
        description: 'Member uuid and admin flag for an authenticated email',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {uuid: {type: 'string'}, isAdmin: {type: 'boolean'}},
            },
          },
        },
      },
    },
  })
  async login(@requestBody(EMAIL_BODY) body: {email: string}): Promise<LoginInfo> {
    const email = this.cleanEmail(body.email);

    await this.registerLogin(email);

    const socios = await this.sociosActivosRepository.find({
      where: {or: [{emailempleado: email}, {emailempleado2: email}]},
      limit: 2,
    });
    const uuid = socios.length === 1 ? (socios[0].uuid ?? '').trim() : '';

    return {uuid, isAdmin: await this.isAdminEmail(email)};
  }

  /** Whether the email is listed in the VWCOOPEADMINS view. */
  @post('/users/is-admin', {
    responses: {
      '200': {
        description: 'Admin flag for an email',
        content: {
          'application/json': {
            schema: {type: 'object', properties: {isAdmin: {type: 'boolean'}}},
          },
        },
      },
    },
  })
  async isAdmin(
    @requestBody(EMAIL_BODY) body: {email: string},
  ): Promise<{isAdmin: boolean}> {
    return {isAdmin: await this.isAdminEmail(this.cleanEmail(body.email))};
  }

  private cleanEmail(email: string): string {
    const clean = (email ?? '').trim();
    if (!clean) {
      throw new HttpErrors.BadRequest('email is required');
    }
    return clean;
  }

  private async isAdminEmail(email: string): Promise<boolean> {
    const admins = await this.adminsRepository.find({
      where: {or: [{emailempleado: email}, {emailempleado2: email}]},
      limit: 1,
    });
    return admins.length > 0;
  }

  private async registerLogin(email: string): Promise<void> {
    const schema = db2config.schema ?? 'COOPE';
    if (!IDENTIFIER.test(schema)) {
      throw new Error('Invalid DB2_SCHEMA');
    }
    try {
      // The schema is trusted configuration validated above; the email is bound as a parameter.
      await this.dataSource.execute(
        `INSERT INTO ${schema}.USERSLOGIN (EMAILEMPLEADO, FECLOGIN) VALUES (?, CURRENT TIMESTAMP)`,
        [email],
      );
    } catch (err) {
      // A failing audit insert must not prevent the login
      console.error('Error inserting into USERSLOGIN:', (err as Error).message);
    }
  }
}
