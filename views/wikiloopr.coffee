load_wiki_page = (pagename, ret) ->
  console.log 'http://en.wikipedia.org/w/api.php?action=parse&format=json&redirects=&prop=text&page=' + pagename
  $.ajax
    url: 'http://en.wikipedia.org/w/api.php?action=parse&format=json&redirects=&prop=text&page=' + pagename
    dataType: 'jsonp'
    success: (page) ->
      if page.error?
        put_on_page '', page.error.info
        $('#start input').removeAttr('disabled')
      else
        put_on_page pagename, page.parse.title
        ret page.parse.text['*']

find_first_link_in_page = (pagename, ret) ->
  load_wiki_page pagename, (html) ->
    doc = document.createElement('html')
    $(doc).append html
    $(doc).find('table').remove()
    $(doc).find('.dablink').remove()
    $(doc).find('.thumb').remove()
    paragraphs = $(doc).find('p')
    link = find_first_link_in_elements paragraphs
    return ret link if link?
    lis = $(doc).find('li')
    link = find_first_link_in_elements lis
    return ret link if link?


find_first_link_in_elements = (elements) ->
  for element in elements
    $(element).find('i').remove()
    $(element).find('.new').remove()
    $(element).find('sup').remove()
    $(element).find('.nowrap').remove()
    $(element).find('.extiw').remove()
    $(element).find('.IPA').remove()
    $(element).find('img').remove()
    $(element).find('b').remove()
    $(element).find('#coordinates').remove()
    i = 0
    links = []
    $(element).find('a').each ->
      links.push $(this).attr('href')
      $(this).attr('href', i)
      i += 1
    paragraphHTML = $(element).html()
    paragraphHTML = remove_parens paragraphHTML
    element = document.createElement('p')
    $(element).append paragraphHTML
    linkIndex = $(element).find('a').first().attr('href')
    link = links[linkIndex]
    return link.substr(6) if link?


remove_parens = (html) ->
  first_paren = html.indexOf('(')
  second_paren = first_paren + html.substr(first_paren).indexOf(')')
  if first_paren == -1 or first_paren > second_paren
    return html
  else
    remove_parens html.substr(0, first_paren)+html.substr(second_paren + 1)

find_all_links = (pagename, visited) ->
  $('#loading').fadeIn()
  find_first_link_in_page pagename, (link) ->
    if link not in visited
      visited.push link
      find_all_links link, visited
    else
      $('#results a').last().addClass('end')
      $('a:contains("'+link+'")').addClass('end')
      $('#start input').removeAttr('disabled')
      $('#loading').fadeOut()

put_on_page = (href, title) ->
  console.log title
  $('#start input').attr('disabled', 'disabled')
  $('#start input').blur()
  $('.ui-autocomplete').hide()
  $('#results a').last().removeClass('end1')
  link = document.createElement('a')
  $(link).attr('href', 'http://en.wikipedia.org/wiki/' + href)
  $(link).text(title).addClass('end1').attr('target', '_blank')
  item = $(document.createElement('li')).append(link).hide()
  $('#results').append(item)
  $(item).fadeIn(300)
  $("html, body").animate
    scrollTop: $(item).offset().top
  , 0
  
swapColors = ->
  endItems = $('.end')
  if $(endItems[0]).hasClass 'end1'
    $(endItems[0]).removeClass 'end1'
    $(endItems[1]).addClass 'end1'
  else
    $(endItems[0]).addClass 'end1'
    $(endItems[1]).removeClass 'end1'

window.onpopstate = (e) ->
  if e.state?
    $('#results').clearQueue()
    $('li').clearQueue()
    $('#results').empty()
    $('#start input').val(e.state.query)
    find_all_links e.state.query, []

$ ->

  $("#start input").autocomplete source: (request, response) ->
    $.ajax
      url: "http://en.wikipedia.org/w/api.php"
      dataType: "jsonp"
      data:
        action: "opensearch"
        format: "json"
        search: request.term

      success: (data) ->
        response data[1]
        $('li a.ui-corner-all').click ->
          $('#results').empty()
          pagename = $(this).text()
          stateObj = {query: pagename}
          history.pushState(stateObj, pagename, '/'+pagename)
          find_all_links pagename, []



  $('#results').empty()
  if query.length > 0
    $('#start input').blur()
    $('#start input').val(query)
    find_all_links query, []
  $('#start').submit (e) ->
    $('.ui-autocomplete').hide()
    $('#start input').blur()
    $('#results').clearQueue()
    $('li').clearQueue()
    $('#results').empty()
    e.preventDefault()
    pagename = $(this).find('input').val()
    pagename = $(this).find('input').attr('placeholder') if pagename is ''
    stateObj = {query: pagename}
    history.pushState(stateObj, pagename, '/'+pagename)
    find_all_links pagename, []
  setInterval swapColors, 1000

  $("a[href^=http]").each ->
    if @href.indexOf(location.hostname) is -1
      $(this).attr
        target: "_blank"
        title: "Opens in a new window"