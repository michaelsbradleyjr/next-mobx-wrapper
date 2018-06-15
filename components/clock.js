import {inject, observer} from 'mobx-react';

export default inject('my_store')(observer(({ my_store }) => (
    <div className={my_store.light ? 'light' : ''}>
      {format(new Date(my_store.lastUpdate))}
      <style jsx>{`
        div {
          padding: 15px;
          color: #82FA58;
          display: inline-block;
          font: 50px menlo, monaco, monospace;
          background-color: #000;
        }

        .light {
          background-color: #999;
        }
      `}</style>
    </div>
)));

const format = (t) => (
    `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`
);

const pad = (n) => n < 10 ? `0${n}` : n;
