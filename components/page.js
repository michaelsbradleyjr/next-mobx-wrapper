import Link from 'next/link';
import {Component} from 'react';

import Clock from './clock';

export default class extends Component {
    render () {
        return (
            <div>
              <h1>{this.props.title}</h1>
              <Clock />
              <br /><br />
              {/*
                  <nav>
                      <Link href={this.props.linkTo}><a>Navigate</a></Link>
                  </nav>
              */}
            </div>
        );
    }
};
