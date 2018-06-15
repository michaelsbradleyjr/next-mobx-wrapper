import {inject, observer} from 'mobx-react';
import {Component} from 'react';

import Page from '../components/page';
import store from '../components/store';

import withMobX from '../src/';

export default withMobX('my_store', store)(
    @inject('my_store')
    @observer
    class Index extends Component {
        componentDidMount () {
            this.props.my_store.start();
        }

        componentWillUnmount () {
            this.props.my_store.stop();
        }

        render () {
            return (
                <div>
                  {/*<Page title='Index Page' linkTo='/other' />*/}
                  <Page title='Index Page' />
                  <p>Raw clocks: &nbsp;
                    {this.props.my_store.lastUpdate}&ensp;
                  </p>
                </div>
            );
        }
    }
);
