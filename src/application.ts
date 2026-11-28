import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {HealthComponent} from '@loopback/extension-health';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {CrudRestComponent} from '@loopback/rest-crud';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import path from 'path';
import {cloudantconfig} from './datasources/env';
import {filterSanitizerInterceptor} from './interceptors/filter-sanitizer.interceptor';
import {MySequence} from './sequence';
import {CLOUDANT_CLIENT, CloudantClient} from './services/cloudant.service';

export {ApplicationConfig};

export class CoopeibmDataapiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Reject filters (order/limit/skip) that could alter the SQL text
    this.interceptor(filterSanitizerInterceptor, {
      global: true,
      group: 'filterSanitizer',
    });

    // Cloudant access (credentials only live in this service)
    this.bind(CLOUDANT_CLIENT).to(new CloudantClient(cloudantconfig));

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);
    this.component(HealthComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
    this.component(CrudRestComponent);
  }
}
