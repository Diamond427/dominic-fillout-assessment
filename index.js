const express = require('express')
const axios = require('axios')
const app = express()

const fillout_api_endpoint_template = "https://api.fillout.com/v1/api/forms/:form_id/submissions";
const AUTH_TOKEN = "Bearer sk_prod_TfMbARhdgues5AuIosvvdAC9WsA5kXiZlW8HZPaRDlIbCpSpLsXBeZO7dCVZQwHAY3P4VSBPiiC33poZ1tdUj2ljOzdTCCOSpUZ_3912";

axios.defaults.headers.common['Authorization'] = AUTH_TOKEN;

async function getTotalData(url) {
  const response = await axios.get(url);
  const data = response.data;
  const count = data.totalResponses || 0;
  const totalData = [];

  for(let i = 0; i < count; i += 150) {
    const {data} = await axios.get(url + `&offset=${i}`);
    totalData.push(... data.responses);
  }
  return totalData;
}

function Filter(records, filters) {
  function Satisfy(record, filter) {
    switch(filter.condition) {
      case "equals":
        return record.value == filter.value
      case "greater_than":
        return record.value > filter.value
      case "does_not_equal":
        return record.value != filter.value
      case "less_than":
        return record.value < filter.value
    }
    return false
  }

  if(!filters) return records;
  return records.filter(record => {
    const {questions} = record;
    return filters.every(filter => {
      const found = questions.find(q => q.id === filter.id);
      if(!found) return true;
      return Satisfy(found, filter);
    })
  })
}

function Pagify(data, limit, offset) {
  return {
    responses: data.slice(offset, offset + limit),
    totalResponses: data.length,
    pageCount: Math.ceil(data.length / limit)
  }
}

app.get('/:formId/filteredResponses', async function (req, res) {
  const fillout_api_endpoint = fillout_api_endpoint_template.replace(':form_id', req.params.formId);
  let {limit, offset, filters, ...extra_query_params} = req.query;

  const query = new URLSearchParams(extra_query_params);
  const with_query = fillout_api_endpoint + "?" + query.toString();

  limit = Number(limit) || 150;
  offset = Number(offset) || 0;
  
  const total = await getTotalData(with_query);
  try {
    const parsed_filters = JSON.parse(filters);
    const filtered = Filter(total, parsed_filters);
    res.json(Pagify(filtered, limit, offset));
  }
  catch(e) {
    res.status(400).send(`filter: ${filters}, error: ${e}`);
  }
})

app.listen(3000)